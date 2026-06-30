import axios from "axios";

const API = axios.create({
  baseURL: "http://192.168.29.172:8080",
});

export default API;