const http = require("http");
const PORT = 3000;
const inventory = {}; 

function applyEvent(event) {
  inventory[event.sku] = {
    quantity: event.quantity,
    lastEventTimestamp: event.timestamp,
    updatedAt: new Date().toISOString(),
  };
  return { status: "applied", current: inventory[event.sku] };
}

const server = http.createServer((req, res) => {
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    const rawBody = Buffer.concat(chunks);

    if (req.method === "POST" && req.url === "/webhooks/inventory") {
      let event;
      try {
        event = JSON.parse(rawBody.toString());
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "invalid JSON" }));
      }

      const required = ["event_id", "sku", "quantity", "timestamp"];
      const missing = required.filter((f) => event[f] === undefined);
      if (missing.length > 0) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "missing fields", missing }));
      }

      const result = applyEvent(event);
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(result));
    }

    if (req.method === "GET" && req.url.startsWith("/inventory/")) {
      const sku = decodeURIComponent(req.url.split("/inventory/")[1]);
      const item = inventory[sku];
      res.writeHead(item ? 200 : 404, { "Content-Type": "application/json" });
      return res.end(
        item
          ? JSON.stringify({ sku, in_stock: item.quantity > 0, quantity: item.quantity, updated_at: item.updatedAt })
          : JSON.stringify({ sku, in_stock: false, error: "unknown sku" })
      );
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });
});

server.listen(PORT, () => {
  console.log(`Minimal webhook sync listening on http://localhost:${PORT}`);
});
