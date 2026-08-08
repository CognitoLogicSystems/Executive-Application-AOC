package aranet.core;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class AraNetTerminal {
    private static final Pattern LOG_PATTERN = Pattern.compile("\\[(.*?)] \\((.*?)\\) (.*)");

    public static void main(String[] args) throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 8080), 0);
        server.createContext("/api/command", new CommandHandler());
        server.createContext("/api/serpent-audit", new SerpentAuditHandler());
        server.setExecutor(null);
        System.out.println(">> AraNet Local Web Bridge Active on http://127.0.0.1:8080 <<<");
        server.start();
    }

    static class CommandHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            String response = "{\"status\":\"DEPLOY-READY\",\"message\":\"AraNet Core Response Received\",\"owner\":\"PAUL M MARTINEZ\"}";
            byte[] responseBytes = response.getBytes(StandardCharsets.UTF_8);

            exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
            exchange.sendResponseHeaders(200, responseBytes.length);

            try (OutputStream os = exchange.getResponseBody()) {
                os.write(responseBytes);
            }
        }
    }

    static class SerpentAuditHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            String requestBody = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8).trim();
            String rawLogLine = extractRawLogLine(exchange, requestBody);

            String response = evaluateAuditLog(rawLogLine);
            byte[] responseBytes = response.getBytes(StandardCharsets.UTF_8);

            exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
            exchange.sendResponseHeaders(200, responseBytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(responseBytes);
            }
        }
    }

    private static void addCorsHeaders(HttpExchange exchange) {
        exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type");
    }

    private static String extractRawLogLine(HttpExchange exchange, String requestBody) throws IOException {
        if (!requestBody.isEmpty()) {
            if (requestBody.startsWith("{")) {
                Matcher jsonMatcher = Pattern.compile("\"raw_log_line\"\\s*:\\s*\"(.*?)\"", Pattern.DOTALL).matcher(requestBody);
                if (jsonMatcher.find()) {
                    return jsonMatcher.group(1)
                            .replace("\\\"", "\"")
                            .replace("\\\\", "\\")
                            .replace("\\n", "\n");
                }
            }
            return requestBody;
        }

        String query = exchange.getRequestURI().getRawQuery();
        if (query == null || query.isBlank()) {
            return "";
        }

        for (String pair : query.split("&")) {
            String[] kv = pair.split("=", 2);
            if (kv.length == 2 && "raw_log_line".equals(kv[0])) {
                return URLDecoder.decode(kv[1], StandardCharsets.UTF_8);
            }
        }
        return "";
    }

    private static String evaluateAuditLog(String rawLogLine) {
        Matcher match = LOG_PATTERN.matcher(rawLogLine);
        if (!match.matches()) {
            return "{\"status\":\"ERROR\",\"reason\":\"Unrecognized log format\",\"violations_flagged\":[]}";
        }

        String timestamp = match.group(1);
        String collector = match.group(2);
        String message = match.group(3);

        String timeStr = "";
        String[] timestampParts = timestamp.split(" ");
        if (timestampParts.length > 1 && timestampParts[1].length() >= 5) {
            timeStr = timestampParts[1].substring(0, 5);
        }

        String messageLower = message.toLowerCase(Locale.ROOT);
        List<String> flags = new ArrayList<>();

        if ((timeStr.compareTo("21:00") > 0) || (!timeStr.isEmpty() && timeStr.compareTo("08:00") < 0)
                || messageLower.contains("restricted hours")) {
            flags.add("RESTRICTED_HOURS");
        }

        if (messageLower.contains("lawsuit") || messageLower.contains("sue")) {
            flags.add("UNAUTHORIZED_LAWSUIT_THREAT");
        }

        if (messageLower.contains("misleading") || messageLower.contains("false status")) {
            flags.add("DECEPTIVE_MISREPRESENTATION");
        }

        if (messageLower.contains("officer")
                || messageLower.contains("police")
                || messageLower.contains("sheriff")
                || messageLower.contains("badge")) {
            flags.add("FALSE_LAW_ENFORCEMENT_CLAIM");
        }

        StringBuilder flagJson = new StringBuilder("[");
        for (int i = 0; i < flags.size(); i++) {
            if (i > 0) {
                flagJson.append(",");
            }
            flagJson.append("\"").append(flags.get(i)).append("\"");
        }
        flagJson.append("]");

        return "{"
                + "\"timestamp\":\"" + jsonEscape(timestamp) + "\","
                + "\"collector\":\"" + jsonEscape(collector) + "\","
                + "\"message\":\"" + jsonEscape(message) + "\","
                + "\"violations_flagged\":" + flagJson
                + "}";
    }

    private static String jsonEscape(String value) {
        return value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }
}
