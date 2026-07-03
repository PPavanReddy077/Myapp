import axios from "axios";

const API = axios.create({
  baseURL: "http://192.168.31.159:8080",
});
export default API;