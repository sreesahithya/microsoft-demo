import { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";


function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loggedIn, setLoggedIn] = useState(false);

  const [pdf, setPdf] = useState(null);
  const [pdfUploaded, setPdfUploaded] = useState(false);

  const [question, setQuestion] = useState("");
  const [chat, setChat] = useState([]);
  const [history, setHistory] = useState([]);

  // ================= SIGNUP =================
  const API_URL = "https://microsoft-demo-1.onrender.com";
   useEffect(() => {
  if (loggedIn && pdfUploaded) {
    loadHistory();
  }
}, [loggedIn, pdfUploaded]);
  const signup = async () => {
  try {
    const res = await axios.post(`${API_URL}/signup`, {
      email,
      password,
    });
   

    alert(res.data.message);

    // ✅ AUTO LOGIN AFTER SIGNUP
    const loginRes = await axios.post(`${API_URL}/login`, {
      email,
      password,
    });

    localStorage.setItem("token", loginRes.data.token);
    setLoggedIn(true);

  } catch (error) {
    alert(error.response?.data?.message || "Signup Failed");
  }
};

  // ================= LOGIN =================
  const login = async () => {
    try {
      const res = await axios.post(`${API_URL}/login`, {
        email,
        password,
      });

      localStorage.setItem("token", res.data.token);
      setLoggedIn(true);
    } catch (error) {
      alert(error.response?.data?.message || "Login Failed");
    }
  };
  const loadHistory = async () => {
  try {
    const token = localStorage.getItem("token");

    const res = await axios.get(
      `${API_URL}/chat-history`,
      {
        headers: {
          Authorization: token,
        },
      }
    );

    setHistory(res.data);
  } catch (err) {
    console.log(err);
  }
};

  // ================= UPLOAD PDF =================
 const uploadPdf = async () => {
  if (!pdf) return;

  try {
    const token = localStorage.getItem("token");

    const formData = new FormData();
    formData.append("pdf", pdf);

    const res = await axios.post(
      `${API_URL}/upload-pdf`,
      formData,
      {
        headers: {
          Authorization: token,
        },
      }
    );

    alert(res.data.message);

    setPdfUploaded(true);
  } catch (error) {
    console.log(error);
    alert("Upload failed");
  }
};

  // ================= CHAT =================
  const sendQuestion = async () => {
  if (!question.trim()) return;

  const currentQuestion = question;

  const token = localStorage.getItem("token");
  
  const userMsg = {
    role: "user",
    text: currentQuestion,
  };

  setChat((prev) => [...prev, userMsg]);

  setQuestion("");

  try {
    const res = await axios.post(
      `${API_URL}/chat`,
      { question: currentQuestion },
      {
        headers: {
          Authorization: token,
        },
      }
    );
    const formattedAnswer = res.data.answer .replace(/\d+\.\s/g, "\n• ") .replace(/\*\*(.*?)\*\*/g, "$1");


    const botMsg = {
      role: "bot",
      text: res.data.answer,
    };

    setChat((prev) => [...prev, botMsg]);

    loadHistory();

  } catch (error) {
    setChat((prev) => [
      ...prev,
      {
        role: "bot",
        text: "Error getting response",
      },
    ]);
  }
};

 return (
  <div className="app">
    {!loggedIn ? (
      <div className="authBox">
        <h3>AI Customer Support 🤖</h3>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div className="btnRow">
          <button className="primary" onClick={signup}>
            Signup
          </button>

          <button className="secondary" onClick={login}>
            Login
          </button>
        </div>
      </div>
    ) : !pdfUploaded ? (
      <div className="uploadPage">
        <h2>Upload Your PDF 📄</h2>

        <input
          type="file"
          accept=".pdf"
          onChange={(e) => setPdf(e.target.files[0])}
        />

        <button className="uploadBtn" onClick={uploadPdf}>
          Upload & Start Chat
        </button>
      </div>
    ) : (
      <div className="chatContainer">
        

        {/* Chat Area */}
        <div className="chatPage">
          <h2>Chat with PDF 🤖</h2>

          <div className="chatBox">
            {chat.map((msg, i) => (
              <div
                key={i}
                className={`msg ${
                  msg.role === "user" ? "user" : "bot"
                }`}
                style={{ whiteSpace: "pre-wrap" }}
              >
                {msg.text}
              </div>
            ))}
          </div>

          <div className="inputBox">
            <input
              value={question}
              placeholder="Type a message..."
              onChange={(e) => setQuestion(e.target.value)}
            />

            <button
              className="sendBtn"
              onClick={sendQuestion}
            >
              ➤
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
);
}

export default App;     