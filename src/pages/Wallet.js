import React, { useCallback, useEffect, useState } from "react";
import api from "../api/api";
import "./Wallet.css";

const Wallet = () => {
  const [wallet, setWallet] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(null);
  const [selectedTier, setSelectedTier] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bkash");
  const [senderMsisdn, setSenderMsisdn] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [selectedPack, setSelectedPack] = useState(null);
  const [claimingReward, setClaimingReward] = useState(false);
  const [tipUsername, setTipUsername] = useState("");
  const [tipCoins, setTipCoins] = useState("");
  const [sendingTip, setSendingTip] = useState(false);

  const loadWallet = useCallback(async () => {
    try {
      setError("");
      setLoading(true);
      const response = await api.get("/wallet");
      setWallet(response.data);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to load your wallet.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWallet();
    api.get("/config/flags").then((response) => setConfig(response.data)).catch(() => {});
    const interval = setInterval(() => void loadWallet(), 60000);
    return () => clearInterval(interval);
  }, [loadWallet]);

  const tiers = config?.subscriptionTiers || {};
  const selectedPlan = selectedTier ? tiers[selectedTier] : null;
  const coinPacks = config?.coinPacks || [];
  const submitPayment = async (event) => {
    event.preventDefault();
    if ((!selectedPlan && !selectedPack) || !senderMsisdn.trim() || !transactionId.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      await api.post("/payments/submit", {
        paymentMethod,
        senderMsisdn: senderMsisdn.trim(),
        transactionId: transactionId.trim(),
        type: selectedPack ? "wallet_topup" : "subscription",
        amountBDT: selectedPack?.priceBDT || selectedPlan.priceBDT,
        subscriptionTier: selectedPack ? undefined : selectedTier,
        coinsAmount: selectedPack?.coins,
      });
      setNotice("Payment submitted for review. We will notify you after approval.");
      setSenderMsisdn("");
      setTransactionId("");
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to submit payment.");
    } finally {
      setSubmitting(false);
    }
  };
  const claimDailyReward = async () => {
    if (!wallet?.dailyRewardAvailable || claimingReward) return;
    setClaimingReward(true);
    setError("");
    try {
      await api.post("/wallet/daily-reward");
      await loadWallet();
      setNotice(`You received ${wallet?.dailyRewardCoins || 10} free coins.`);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to claim daily coins.");
    } finally {
      setClaimingReward(false);
    }
  };
  const sendTip = async (event) => {
    event.preventDefault();
    const amountCoins = Number(tipCoins);
    if (!tipUsername.trim() || !Number.isInteger(amountCoins) || amountCoins < 1) return;
    setSendingTip(true);
    setError("");
    try {
      const response = await api.post("/tips/send", {
        recipientUsername: tipUsername.trim(),
        amountCoins,
      });
      setNotice(response.data?.message || "Tip sent successfully.");
      setTipUsername("");
      setTipCoins("");
      await loadWallet();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to send tip.");
    } finally {
      setSendingTip(false);
    }
  };

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
            <strong>{loading ? "..." : wallet?.walletBalanceCoins ?? 0}</strong>
          </div>
          <div className="wallet-subscription">
            <h2>Creator earnings</h2>
            <p>{wallet?.creatorEarningsCoins ?? 0} coins received from tips.</p>
          </div>
          <div className="wallet-subscription">
            <h2>Daily free coins</h2>
            <p>Claim {wallet?.dailyRewardCoins || 10} coins once every day without recharging.</p>
            <button type="button" className="wallet-submit" onClick={() => void claimDailyReward()} disabled={!wallet?.dailyRewardAvailable || claimingReward}>
              {claimingReward ? "Claiming..." : wallet?.dailyRewardAvailable ? "Claim free coins" : "Already claimed today"}
            </button>
          </div>
          {config?.featureFlags?.tippingEnabled ? (
            <div className="wallet-subscription">
              <h2>Tip a creator</h2>
              <p>Send coins to a creator. A {config.tipping?.platformFeePercent ?? 20}% platform fee applies.</p>
              <form className="wallet-payment-form" onSubmit={sendTip}>
                <label>Creator username<input value={tipUsername} onChange={(event) => setTipUsername(event.target.value)} required placeholder="creator_username" /></label>
                <label>Coins to send<input type="number" min="1" max="100000" value={tipCoins} onChange={(event) => setTipCoins(event.target.value)} required placeholder="10" /></label>
                <button type="submit" className="wallet-submit" disabled={sendingTip}>{sendingTip ? "Sending..." : "Send tip"}</button>
              </form>
            </div>
          ) : null}
        </div>
        <div className="wallet-subscription">
          <h2>Subscription</h2>
          <p>
            {wallet?.connectPlusActive
              ? `${wallet.subscriptionTier} active`
              : "No active subscription"}
          </p>
          {wallet?.subscriptionExpiresAt ? (
            <small>Expires {new Date(wallet.subscriptionExpiresAt).toLocaleDateString()}</small>
          ) : null}
        </div>
        {config?.featureFlags?.subscriptionEnabled || config?.featureFlags?.walletEnabled ? (
          <div className="wallet-purchase">
            <h2>{selectedPack ? "Add coins" : "Upgrade to Connect+"}</h2>
            <p>Choose a plan, send the exact amount, then submit your transaction ID.</p>
            <div className="wallet-plans">
              {config?.featureFlags?.subscriptionEnabled && Object.entries(tiers).map(([tier, plan]) => (
                <button type="button" key={tier} className={`wallet-plan ${selectedTier === tier ? "selected" : ""}`} onClick={() => setSelectedTier(tier)} disabled={!plan.enabled}>
                  <strong>{tier.replace("_", " ")}</strong>
                  <span>৳{plan.priceBDT} / {plan.durationDays} days</span>
                </button>
              ))}
              {config?.featureFlags?.walletEnabled && coinPacks.map((pack) => (
                <button type="button" key={`coin-${pack.coins}`} className={`wallet-plan ${selectedPack?.coins === pack.coins ? "selected" : ""}`} onClick={() => { setSelectedPack(pack); setSelectedTier(""); }} disabled={!pack.enabled}>
                  <strong>{pack.coins} coins</strong>
                  <span>৳{pack.priceBDT}</span>
                </button>
              ))}
            </div>
            {(selectedPlan || selectedPack) && config.featureFlags.manualPaymentEnabled ? (
              <form className="wallet-payment-form" onSubmit={submitPayment}>
                <p><b>Payment instructions:</b> Send ৳{selectedPlan?.priceBDT || selectedPack.priceBDT} to bKash {config.paymentNumbers?.bkash || "number not configured"} or Nagad {config.paymentNumbers?.nagad || "number not configured"}.</p>
                <label>Payment method<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="bkash">bKash</option><option value="nagad">Nagad</option></select></label>
                <label>Sender phone number<input value={senderMsisdn} onChange={(event) => setSenderMsisdn(event.target.value)} required placeholder="01XXXXXXXXX" /></label>
                <label>Transaction ID<input value={transactionId} onChange={(event) => setTransactionId(event.target.value)} required placeholder="TrxID" /></label>
                <button type="submit" className="wallet-submit" disabled={submitting}>{submitting ? "Submitting..." : "Submit for review"}</button>
              </form>
            ) : null}
            {notice ? <p className="wallet-success" role="status">{notice}</p> : null}
          </div>
        ) : null}
      </section>
    </main>
  );
};

export default Wallet;
