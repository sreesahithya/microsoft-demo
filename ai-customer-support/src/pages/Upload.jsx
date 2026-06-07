import { useState } from "react";
import axios from "axios";

function Upload() {
  const [pdf, setPdf] = useState(null);

  const uploadPdf = async () => {
    try {
      const formData = new FormData();

      formData.append("pdf", pdf);

      const res = await axios.post(
        "http://localhost:5000/upload-pdf",
        formData
      );

      alert(res.data.message);

    } catch (error) {
      console.log(error);
      alert("Upload failed");
    }
  };

  return (
    <div style={{ padding: "40px" }}>
      <h1>Upload Company PDF</h1>

      <input
        type="file"
        accept=".pdf"
        onChange={(e) => setPdf(e.target.files[0])}
      />

      <br />
      <br />

      <button onClick={uploadPdf}>
        Upload PDF
      </button>
    </div>
  );
}

export default Upload;