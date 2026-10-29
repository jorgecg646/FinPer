import assert from "node:assert/strict"
import test from "node:test"
import { resolveTradingViewLogoId } from "../lib/tradingview-symbol"

test("resolves crypto and commodity logos from TradingView symbols", () => {
  assert.equal(resolveTradingViewLogoId("BINANCE:BTCUSDT"), "crypto/XTVCBTC")
  assert.equal(resolveTradingViewLogoId("COINBASE:ETHUSD"), "crypto/XTVCETH")
  assert.equal(resolveTradingViewLogoId("BTC"), "crypto/XTVCBTC")
  assert.equal(resolveTradingViewLogoId("SOL"), "crypto/XTVCSOL")
  assert.equal(resolveTradingViewLogoId("TVC:USOIL"), "crude-oil")
})

test("prefers TradingView-provided logos", () => {
  assert.equal(resolveTradingViewLogoId("BINANCE:BTCUSDT", "custom-logo"), "custom-logo")
  assert.equal(resolveTradingViewLogoId("BINANCE:BTCUSDT", "", "base-logo"), "base-logo")
})

test("does not process excessively long or repetitive symbols", () => {
  assert.equal(resolveTradingViewLogoId("0".repeat(100_000)), "")
  assert.equal(resolveTradingViewLogoId(`BINANCE:${"0".repeat(200)}BTC`), "")
})
