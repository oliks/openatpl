"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

const MILESTONE_INTERVAL = 25;
const DONATION_KEY = "openatpl-last-donation";
const DONATION_COOLDOWN_DAYS = 30;
const STRIPE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const DONATION_SERVER = process.env.NEXT_PUBLIC_DONATION_SERVER;
const stripePromise = STRIPE_KEY && DONATION_SERVER ? loadStripe(STRIPE_KEY) : null;

function isDonationCooldown() {
  try {
    const raw = localStorage.getItem(DONATION_KEY);
    if (!raw) return false;
    const last = new Date(raw).getTime();
    return Date.now() - last < DONATION_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function saveDonation() {
  localStorage.setItem(DONATION_KEY, new Date().toISOString());
}

function CheckoutForm({ onSuccess, onBack }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    const result = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (result.error) {
      setError(result.error.message);
      setLoading(false);
    } else {
      saveDonation();
      onSuccess();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="checkout-form">
      <PaymentElement options={{ layout: "accordion" }} />
      {error && <p className="tiny" style={{ color: "var(--warn)", margin: 0 }}>{error}</p>}
      <div className="checkout-form-actions">
        <button type="button" className="support-later-btn" onClick={onBack}>
          Back
        </button>
        <button
          type="submit"
          className="button button-primary"
          disabled={!stripe || loading}
        >
          {loading ? "Processing..." : "Donate"}
        </button>
      </div>
    </form>
  );
}

export default function CoffeeBanner({ answeredCount, onShow, onDismiss }) {
  const [dismissed, setDismissed] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [clientSecret, setClientSecret] = useState(null);
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [success, setSuccess] = useState(false);
  const [cooledDown, setCooledDown] = useState(true);
  const prevAnswered = useRef(answeredCount);
  const lastMilestone = useRef(0);

  const currentMilestone = Math.floor(answeredCount / MILESTONE_INTERVAL) * MILESTONE_INTERVAL;

  // Check cooldown on mount
  useEffect(() => {
    setCooledDown(isDonationCooldown());
  }, []);

  useEffect(() => {
    if (!DONATION_SERVER || cooledDown) {
      prevAnswered.current = answeredCount;
      if (currentMilestone > lastMilestone.current) {
        lastMilestone.current = currentMilestone;
      }
      return;
    }
    if (
      currentMilestone > 0 &&
      currentMilestone > lastMilestone.current &&
      answeredCount > prevAnswered.current
    ) {
      setShowBanner(true);
      setDismissed(false);
      setClientSecret(null);
      setSuccess(false);
      onShow?.();
    }

    prevAnswered.current = answeredCount;
    if (currentMilestone > lastMilestone.current) {
      lastMilestone.current = currentMilestone;
    }
  }, [answeredCount, currentMilestone, cooledDown, onShow]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    setClientSecret(null);
    onDismiss?.();
  }, [onDismiss]);

  function handleSuccess() {
    setSuccess(true);
    setCooledDown(true);
    // Auto-dismiss after 4 seconds
    setTimeout(() => dismiss(), 4000);
  }

  if (!DONATION_SERVER || cooledDown || !showBanner || dismissed) return null;

  async function handleTier(amount) {
    setLoadingPayment(true);
    try {
      const res = await fetch(`${DONATION_SERVER}/create-payment-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
      }
    } catch {
      window.open("https://buy.stripe.com/28E4gz6nY2XtgRIdAgfEk0Q", "_blank");
      dismiss();
    } finally {
      setLoadingPayment(false);
    }
  }

  if (success) {
    return (
      <div className="support-screen">
        <h2 className="support-title">Thank you!</h2>
        <p className="support-subtitle">Your support means a lot and helps keep OpenATPL running.</p>
        <button type="button" className="button button-secondary" onClick={dismiss}>
          Continue studying
        </button>
      </div>
    );
  }

  if (clientSecret) {
    return (
      <div className="support-screen">
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              theme: "stripe",
              variables: {
                colorPrimary: "#0f7a69",
                borderRadius: "10px",
              },
            },
          }}
        >
          <CheckoutForm
            onSuccess={handleSuccess}
            onBack={() => setClientSecret(null)}
          />
        </Elements>
      </div>
    );
  }

  return (
    <div className="support-screen">
      <h2 className="support-title">How do you enjoy this?</h2>
      <p className="support-subtitle">
        Supporting this project helps keep it alive, as it covers important fees such as hosting, domains and development.
      </p>
      <div className="support-tiers">
        <button
          type="button"
          className="support-tier-btn"
          onClick={() => handleTier(5)}
          disabled={loadingPayment}
        >
          <span className="support-tier-emoji">🤩</span>
          <span className="support-tier-label">Excellent</span>
          <span className="support-tier-price">5&euro;</span>
        </button>
        <button
          type="button"
          className="support-tier-btn"
          onClick={() => handleTier(2)}
          disabled={loadingPayment}
        >
          <span className="support-tier-emoji">😊</span>
          <span className="support-tier-label">Great</span>
          <span className="support-tier-price">2&euro;</span>
        </button>
        <button
          type="button"
          className="support-tier-btn"
          onClick={() => handleTier(1)}
          disabled={loadingPayment}
        >
          <span className="support-tier-emoji">👍</span>
          <span className="support-tier-label">Good</span>
          <span className="support-tier-price">1&euro;</span>
        </button>
        <button
          type="button"
          className="support-other-btn"
          onClick={() => handleTier(3)}
          disabled={loadingPayment}
        >
          {loadingPayment ? "..." : "Other"}
        </button>
      </div>
      <button type="button" className="support-later-btn" onClick={dismiss}>
        Maybe later
      </button>
    </div>
  );
}
