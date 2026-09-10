import React, { useCallback, useEffect, useState } from "react";
import api from "../api/api";
import "./Wallet.css";

const Wallet = () => {
  const [wallet, setWallet] = useState(null);
  const [error, setError] = useState("");

  const loadWallet = useCallback(async () => {
    try {
      setError("");
      const response = await api.get("/wallet");
      setWallet(response.data);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to load your wallet.");
    }
  }, []);

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  return (
    <main className="wallet-page">
      <section className="wallet-card" aria-labelledby="wallet-title">
        <div className="wallet-heading">
          <div>
            <h1 id="wallet-title">My Wallet</h1>
            <p>Your balance is read securely from the server.</p>
          </div>
          <button type="button" onClick={() => void loadWallet()} className="wallet-refresh">
            Refresh
          </button>
        </div>
        {error ? <p className="wallet-error" role="alert">{error}</p> : null}
        <div className="wallet-balance">
          <span className="wallet-coin-icon" aria-hidden="true">●</span>
          <div>
            <span className="wallet-label">Available coins</span>
            <strong>{wallet?.walletBalanceCoins ?? 0}</strong>
          </div>
        </div>
        <div className="wallet-subscription">
          <h2>Subscription</h2>
          <p>
            {wallet?.subscriptionStatus === "active"
              ? `${wallet.subscriptionTier} active`
              : "No active subscription"}
          </p>
          {wallet?.subscriptionExpiresAt ? (
            <small>Expires {new Date(wallet.subscriptionExpiresAt).toLocaleDateString()}</small>
          ) : null}
        </div>
      </section>
    </main>
  );
};

export default Wallet;
