const TradingView = require("@mathieuc/tradingview");

async function testQuote(symbol) {
  return new Promise((resolve, reject) => {
    const client = new TradingView.Client();
    const quote = new client.Session.Quote({ fields: "all" });
    const market = new quote.Market(symbol);

    let accumulated = {};

    market.onData((data) => {
      console.log(`[${symbol}] packet keys:`, Object.keys(data));
      if (data.description) console.log(`[${symbol}] description:`, data.description);
      if (data.logoid) console.log(`[${symbol}] logoid:`, data.logoid);
      if (data.lp) console.log(`[${symbol}] lp:`, data.lp);

      Object.assign(accumulated, data);

      if (accumulated.lp) {
        try { market.close(); } catch {}
        try { quote.delete(); } catch {}
        try { client.end(); } catch {}
        resolve(accumulated);
      }
    });

    market.onError((err) => {
      try { client.end(); } catch {}
      reject(err);
    });

    setTimeout(() => {
      try { client.end(); } catch {}
      resolve(accumulated);
    }, 5000);
  });
}

async function run() {
  console.log("--- Testing AAPL ---");
  const a = await testQuote("NASDAQ:AAPL");
  console.log("AAPL final name:", a.description, "logoid:", a.logoid, "lp:", a.lp);

  console.log("\n--- Testing TSLA ---");
  const t = await testQuote("NASDAQ:TSLA");
  console.log("TSLA final name:", t.description, "logoid:", t.logoid, "lp:", t.lp);
}

run().catch(console.error);
