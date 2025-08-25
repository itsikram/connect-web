import axios from "axios";

let user = localStorage.getItem("user") || '{}'
let userJson = JSON.parse(user)
let token = userJson.accessToken

const api = axios.create({
    baseURL: process.env.REACT_APP_SERVER_ADDR+'/api/',
    headers: {
        'Authorization' : `${token}`,
        "User-Agent": "MyCustomUserAgent",
        "Access-Control-Allow-Origin": "*",
        
    }
})

export default api;