import axios from "axios";

const baseURL = "http://localhost:3000";

const axiosInstanceWithToken = axios.create({
  baseURL,
  timeout: 50000,
});

axiosInstanceWithToken.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("authToken");
    if (token) {
      config.headers.authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(new Error(error))
);

axiosInstanceWithToken.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("authToken");

      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }

    if (axios.isAxiosError(error)) {
      const backendMsg = (error.response?.data as any)?.message;
      if (typeof backendMsg === 'string' && backendMsg.trim()) {
        return Promise.reject(new Error(backendMsg));
      }
    }
    return Promise.reject(error);
  }
);

const axiosInstanceWithoutToken = axios.create({
  baseURL,
  timeout: 50000,
});

export { axiosInstanceWithToken, axiosInstanceWithoutToken };
