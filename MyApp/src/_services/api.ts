import axios from "axios";

const API = axios.create({
  baseURL: "http://192.168.31.163:8080",
});

export default API;