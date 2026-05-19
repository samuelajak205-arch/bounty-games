import axios from "axios";

const getPesapalBaseUrl = () => {
  return process.env.PESAPAL_MODE === "production"
    ? "https://pay.pesapal.com/v3"
    : "https://cybqa.pesapal.com/pesapalv3";
};

/**
 * Gets the authentication token from Pesapal
 */
export const getPesapalToken = async () => {
  try {
    const response = await axios.post(
      `${getPesapalBaseUrl()}/api/Auth/RequestToken`,
      {
        consumer_key: process.env.PESAPAL_CONSUMER_KEY,
        consumer_secret: process.env.PESAPAL_CONSUMER_SECRET,
      },
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );
    return response.data.token;
  } catch (error: any) {
    console.error("Pesapal Auth Error:", error.response?.data || error.message);
    throw new Error("Failed to authenticate with Pesapal");
  }
};

/**
 * Registers an IPN URL and gets the IPN ID
 */
export const registerIPN = async (token: string, ipnUrl: string) => {
  try {
    const response = await axios.post(
      `${getPesapalBaseUrl()}/api/URLSetup/RegisterIPN`,
      {
        url: ipnUrl,
        ipn_notification_type: "POST",
      },
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data.ipn_id;
  } catch (error: any) {
    console.error("Pesapal IPN Registration Error:", error.response?.data || error.message);
    throw new Error("Failed to register IPN with Pesapal");
  }
};

/**
 * Submits an order request to Pesapal
 */
export const submitOrder = async (
  token: string,
  ipnId: string,
  orderData: {
    id: string; // Merchant reference
    currency: string;
    amount: number;
    description: string;
    callback_url: string;
    billing_address: {
      email_address: string;
      phone_number: string;
      first_name: string;
      last_name: string;
    };
  }
) => {
  try {
    const response = await axios.post(
      `${getPesapalBaseUrl()}/api/Transactions/SubmitOrderRequest`,
      {
        id: orderData.id,
        currency: orderData.currency,
        amount: orderData.amount,
        description: orderData.description,
        callback_url: orderData.callback_url,
        notification_id: ipnId,
        billing_address: orderData.billing_address,
      },
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data; // Includes redirect_url and order_tracking_id
  } catch (error: any) {
    console.error("Pesapal Submit Order Error:", error.response?.data || error.message);
    throw new Error("Failed to submit order to Pesapal");
  }
};

/**
 * Gets the transaction status from Pesapal
 */
export const getTransactionStatus = async (token: string, orderTrackingId: string) => {
  try {
    const response = await axios.get(
      `${getPesapalBaseUrl()}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data;
  } catch (error: any) {
    console.error("Pesapal Get Status Error:", error.response?.data || error.message);
    throw new Error("Failed to get transaction status from Pesapal");
  }
};
