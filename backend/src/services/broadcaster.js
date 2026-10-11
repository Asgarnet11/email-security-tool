// Broadcaster untuk Server-Sent Events (SSE)
const clients = new Set();

export const addClient = (res) => {
  clients.add(res);
  res.on("close", () => {
    clients.delete(res);
  });
};

export const broadcast = (event, data) => {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try {
      client.write(payload);
    } catch {
      clients.delete(client);
    }
  }
};
