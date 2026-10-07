package app.hyrule.companion;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** A local-only WebView. Its origin is resolved from APK assets, never from the network. */
public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/index.html";
    private static final int OPEN_BACKUP = 10;
    private static final int SAVE_FILE = 11;
    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private PendingSave pendingSave;
    private final ExecutorService files = Executors.newSingleThreadExecutor();

    private static final class PendingSave {
        final String filename, mime, asset;
        final byte[] contents;
        PendingSave(String filename, String mime, String asset, byte[] contents) {
            this.filename = filename; this.mime = mime; this.asset = asset; this.contents = contents;
        }
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(23, 62, 55));
        getWindow().setNavigationBarColor(Color.rgb(23, 62, 55));
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams params = getWindow().getAttributes();
            params.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(params);
        }
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        else getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(23, 62, 55));
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars()
                        | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else {
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                        insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(23, 62, 55));
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setBlockNetworkLoads(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(true);
        settings.setTextZoom(100);
        WebView.setWebContentsDebuggingEnabled(false);
        webView.addJavascriptInterface(new OfflineFiles(), "TotkAndroid");
        webView.setWebViewClient(new LocalClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                    FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/json", "text/plain", "application/octet-stream"});
                try { startActivityForResult(intent, OPEN_BACKUP); }
                catch (ActivityNotFoundException error) {
                    fileCallback.onReceiveValue(null); fileCallback = null;
                    toast("手机未提供文件选择器");
                }
                return true;
            }

            @Override public boolean onCreateWindow(WebView view, boolean dialog, boolean userGesture,
                    android.os.Message message) {
                if (!userGesture) return false;
                WebView popup = new WebView(MainActivity.this);
                popup.getSettings().setBlockNetworkLoads(true);
                popup.setWebViewClient(new WebViewClient() {
                    @Override public boolean shouldOverrideUrlLoading(WebView child, WebResourceRequest request) {
                        openSource(request.getUrl());
                        child.destroy();
                        return true;
                    }
                    @Override public WebResourceResponse shouldInterceptRequest(WebView child, WebResourceRequest request) {
                        return rejected(403, "Forbidden");
                    }
                });
                ((WebView.WebViewTransport) message.obj).setWebView(popup);
                message.sendToTarget();
                return true;
            }
        });
        webView.setDownloadListener((url, agent, disposition, mime, length) -> {
            Uri uri = Uri.parse(url);
            if (isLocal(uri)) saveAsset(uri.getPath());
        });
        root.addView(webView, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        root.requestApplyInsets();
        if (state == null || webView.restoreState(state) == null) webView.loadUrl(START);
    }

    private static boolean isLocal(Uri uri) {
        return "https".equals(uri.getScheme()) && HOST.equals(uri.getHost())
                && (uri.getPort() == -1 || uri.getPort() == 443);
    }

    private final class LocalClient extends WebViewClient {
        @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            if (isLocal(request.getUrl())) return false;
            if (request.isForMainFrame() && request.hasGesture()) openSource(request.getUrl());
            return true;
        }

        @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            if (!isLocal(request.getUrl()) || !"GET".equals(request.getMethod())) return rejected(403, "Forbidden");
            String path = request.getUrl().getPath();
            if (path == null || path.equals("/")) path = "/index.html";
            if (!path.startsWith("/") || path.contains("\\") || path.length() > 256) return rejected(403, "Forbidden");
            for (String part : path.substring(1).split("/")) {
                if (part.equals(".") || part.equals("..") || part.isEmpty()) return rejected(403, "Forbidden");
            }
            String type = mime(path);
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-cache");
            headers.put("X-Content-Type-Options", "nosniff");
            headers.put("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; script-src 'self'; "
                    + "style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; frame-src 'none'");
            try {
                InputStream stream = getAssets().open(path.substring(1));
                return new WebResourceResponse(type, isText(type) ? "UTF-8" : null, 200, "OK", headers, stream);
            } catch (IOException error) { return rejected(404, "Not Found"); }
        }
    }

    private static String mime(String path) {
        String lower = path.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".html")) return "text/html";
        if (lower.endsWith(".js")) return "text/javascript";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".json")) return "application/json";
        if (lower.endsWith(".webmanifest")) return "application/manifest+json";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".csv")) return "text/csv";
        return "application/octet-stream";
    }

    private static boolean isText(String mime) {
        return mime.startsWith("text/") || mime.endsWith("json") || mime.equals("image/svg+xml");
    }

    private static WebResourceResponse rejected(int status, String reason) {
        return new WebResourceResponse("text/plain", "UTF-8", status, reason, new HashMap<>(),
                new ByteArrayInputStream(reason.getBytes(StandardCharsets.UTF_8)));
    }

    private void openSource(Uri uri) {
        if (!"https".equals(uri.getScheme()) || isLocal(uri)) return;
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
        catch (ActivityNotFoundException error) { toast("手机未安装浏览器"); }
    }

    public final class OfflineFiles {
        @JavascriptInterface public void saveTextFile(String name, String type, String text) {
            if (text == null || text.length() > 2 * 1024 * 1024 || !"application/json".equals(type)
                    || name == null || !name.matches("totk-records-[0-9-]+\\.json")) return;
            PendingSave save = new PendingSave(name, type, null, text.getBytes(StandardCharsets.UTF_8));
            runOnUiThread(() -> chooseDestination(save));
        }
        @JavascriptInterface public void saveBundledFile(String path) { runOnUiThread(() -> saveAsset(path)); }
        @JavascriptInterface public void copyText(String contents) {
            if (contents == null || contents.length() > 256) return;
            runOnUiThread(() -> {
                ClipboardManager clipboard = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
                clipboard.setPrimaryClip(ClipData.newPlainText("游戏坐标", contents));
            });
        }
    }

    private void saveAsset(String path) {
        if (!"/data/coordinates.csv".equals(path) && !"/data/equipment.csv".equals(path)) return;
        String asset = path.substring(1);
        chooseDestination(new PendingSave(asset.substring(asset.lastIndexOf('/') + 1), "text/csv", asset, null));
    }

    private void chooseDestination(PendingSave save) {
        if (pendingSave != null) { toast("请先完成当前文件的保存"); return; }
        pendingSave = save;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(save.mime);
        intent.putExtra(Intent.EXTRA_TITLE, save.filename);
        try { startActivityForResult(intent, SAVE_FILE); }
        catch (ActivityNotFoundException error) { pendingSave = null; toast("手机未提供文件保存器"); }
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == OPEN_BACKUP && fileCallback != null) {
            Uri uri = result == RESULT_OK && data != null ? data.getData() : null;
            fileCallback.onReceiveValue(uri == null ? null : new Uri[]{uri});
            fileCallback = null;
        }
        if (request == SAVE_FILE) {
            PendingSave save = pendingSave;
            pendingSave = null;
            Uri uri = result == RESULT_OK && data != null ? data.getData() : null;
            if (uri == null || save == null) return;
            files.execute(() -> {
                try (InputStream input = save.asset == null ? new ByteArrayInputStream(save.contents) : getAssets().open(save.asset);
                        OutputStream output = getContentResolver().openOutputStream(uri, "wt")) {
                    if (output == null) throw new IOException("No output stream");
                    byte[] buffer = new byte[16384];
                    for (int count; (count = input.read(buffer)) != -1;) output.write(buffer, 0, count);
                    toast("已保存 " + save.filename);
                } catch (IOException | SecurityException error) { toast("文件保存失败，请重新选择保存位置"); }
            });
        }
    }

    private void toast(String message) { runOnUiThread(() -> Toast.makeText(this, message, Toast.LENGTH_LONG).show()); }
    @Override protected void onSaveInstanceState(Bundle state) { webView.saveState(state); super.onSaveInstanceState(state); }
    @Override protected void onPause() { webView.onPause(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); if (webView != null) webView.onResume(); }
    @Override protected void onDestroy() {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        webView.removeJavascriptInterface("TotkAndroid");
        webView.destroy();
        files.shutdown();
        super.onDestroy();
    }
}
