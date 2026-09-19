import { useState } from "react";

const currencies = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
];

export default function CurrencyConverter() {
  const [amount, setAmount] = useState("");
  const [fromCurrency, setFromCurrency] = useState("USD");
  const [toCurrency, setToCurrency] = useState("INR");
  const [result, setResult] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const convertCurrency = async () => {
    if (!amount || Number(amount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    if (fromCurrency === toCurrency) {
      setResult(Number(amount));
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `https://api.frankfurter.dev/v2/rate/${fromCurrency.toLowerCase()}/${toCurrency.toLowerCase()}`
      );

      if (!response.ok) {
        throw new Error("Exchange rate could not be loaded");
      }

      const data = await response.json();

      const convertedAmount = Number(amount) * Number(data.rate);

      setResult(convertedAmount);
    } catch (error) {
      console.error("Currency conversion error:", error);

      alert(
        "Currency conversion failed. Please check your internet connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const swapCurrencies = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
    setResult(null);
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 rounded-2xl bg-background border-2 border-border shadow-lg">
      <h2 className="text-2xl font-bold text-center mb-6 text-foreground">
        Currency Converter
      </h2>

      <div className="mb-4">
        <label className="block mb-2 font-semibold text-foreground">
          Amount
        </label>

        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Enter amount"
          className="w-full p-3 rounded-lg border-2 border-border bg-background text-foreground outline-none"
        />
      </div>

      <div className="mb-4">
        <label className="block mb-2 font-semibold text-foreground">
          From
        </label>

        <select
          value={fromCurrency}
          onChange={(e) => setFromCurrency(e.target.value)}
          className="w-full p-3 rounded-lg border-2 border-border bg-background text-foreground"
        >
          {currencies.map((currency) => (
            <option key={currency.code} value={currency.code}>
              {currency.code} - {currency.name}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={swapCurrencies}
        className="w-full mb-4 p-2 rounded-lg border-2 border-border font-semibold text-foreground"
      >
        ⇅ Swap Currencies
      </button>

      <div className="mb-6">
        <label className="block mb-2 font-semibold text-foreground">
          To
        </label>

        <select
          value={toCurrency}
          onChange={(e) => setToCurrency(e.target.value)}
          className="w-full p-3 rounded-lg border-2 border-border bg-background text-foreground"
        >
          {currencies.map((currency) => (
            <option key={currency.code} value={currency.code}>
              {currency.code} - {currency.name}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={convertCurrency}
        disabled={loading}
        className="w-full p-3 rounded-lg font-bold bg-primary text-primary-foreground"
      >
        {loading ? "Converting..." : "Convert"}
      </button>

      {result !== null && (
        <div className="mt-6 p-4 rounded-lg bg-secondary border-2 border-border text-center">
          <p className="text-sm font-semibold text-secondary-foreground">
            Converted Amount
          </p>

          <p className="text-2xl font-bold text-foreground mt-2">
            {result.toFixed(2)} {toCurrency}
          </p>
        </div>
      )}
    </div>
  );
}