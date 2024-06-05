import React, { useState, useEffect } from "react";
import Peer from "peerjs";
import "../App.css";

// Function to generate a numeric peer ID
const generateNumericPeerId = () => {
  return Math.floor(Math.random() * 9000000) + 1000000; // Generates a 7-digit random number
};

const FileTransfer = () => {
  const [peer, setPeer] = useState(null);
  const [peerId, setPeerId] = useState("");
  const [targetPeerId, setTargetPeerId] = useState("");
  const [connection, setConnection] = useState(null);
  const [receivedFile, setReceivedFile] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [modalState, setModalState] = useState({
    isModalOpen: false,
    title: "",
    message: "",
  });

  // Function to show the modal with a title and message
  const showModal = (title, message) => {
    setModalState({ isModalOpen: true, title, message });
  };

  useEffect(() => {
    const newPeerId = generateNumericPeerId();
    const newPeer = new Peer(newPeerId.toString(), {
      host: "0.peerjs.com",
      port: 443,
      path: "/",
      secure: true,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      },
    });

    newPeer.on("open", (id) => {
      console.log("Peer ID:", id);
      setPeerId(id); // Set the peer ID state
    });

    newPeer.on("connection", (conn) => {
      console.log("Connection received from:", conn.peer);
      conn.on("data", (data) => {
        console.log("Data received:", data);
        if (data.type === "file-start") {
          // Notify the receiver about the incoming file transfer
          showModal("Incoming File", `File name: ${data.fileName}`);
        } else if (data.fileName && data.fileContent) {
          const blob = new Blob([data.fileContent]);
          const url = URL.createObjectURL(blob);
          setReceivedFile(data.fileName);
          setDownloadUrl(url);
          showModal("File Received", `File name: ${data.fileName}`);
        }
      });
      setConnection(conn); // Set the connection state
    });

    newPeer.on("disconnected", () => {
      console.warn("Connection lost. Attempting to reconnect...");
      newPeer.reconnect();
    });

    newPeer.on("close", () => {
      console.warn("Connection destroyed.");
    });

    newPeer.on("error", (err) => {
      console.error("PeerJS Error:", err);
    });

    setPeer(newPeer); // Set the peer instance state

    return () => {
      newPeer.destroy();
    };
  }, []);

  const connectToPeer = () => {
    if (!peer) {
      console.error("Peer instance not initialized.");
      return;
    }

    console.log("Connecting to peer:", targetPeerId);
    const conn = peer.connect(targetPeerId); // Connect to the target peer ID

    conn.on("open", () => {
      console.log("Connection opened");
      setConnection(conn); // Set the connection state
    });

    conn.on("error", (err) => {
      console.error("Connection error:", err);
    });
  };

  const sendFile = (file) => {
    if (!connection) {
      showModal("Error", "No connection established.");
      return;
    }

    // Notify the receiver that the file transfer is starting
    connection.send({ type: "file-start", fileName: file.name });

    showModal("Starting File Transfer", `File name: ${file.name}`);

    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result;
      console.log("Sending file:", file.name);
      connection.send({ fileName: file.name, fileContent: arrayBuffer }); // Send the file data
    };
    reader.readAsArrayBuffer(file); // Read the file as an array buffer
  };

  return (
    <div className="h-screen flex items-center justify-center">
      <div id="App" className="mockup-browser border w-11/12 h-5/6">
        <div className="mockup-browser-toolbar">
          <div className="input">{"https://" + window.location.hostname}</div>
        </div>
        <div className="flex justify-center px-4 py-16 bg-base-200 h-full">
          <div>
            <h2>Your Peer ID: {peerId}</h2>
            <input
              type="number"
              placeholder="Enter peer ID"
              value={targetPeerId}
              onChange={(e) => setTargetPeerId(e.target.value)} // Update target peer ID state on input change
            />
            <button onClick={connectToPeer}>Connect</button>
            <input
              type="file"
              onChange={(e) => e.target.files && sendFile(e.target.files[0])}
            />{" "}
            {/* Handle file input change */}
            {receivedFile && (
              <div>
                <h3>File received: {receivedFile}</h3>
                <a href={downloadUrl} download={receivedFile}>
                  Download
                </a>{" "}
                {/* Download link for the received file */}
              </div>
            )}
            {modalState.isModalOpen && (
              <div
                className="modal modal-open"
                onClick={() =>
                  setModalState({ ...modalState, isModalOpen: false })
                }
              >
                <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                  <h3 className="font-bold text-lg">{modalState.title}</h3>
                  <p className="py-4">{modalState.message}</p>
                  <div className="modal-action">
                    <button
                      className="btn"
                      onClick={() =>
                        setModalState({ ...modalState, isModalOpen: false })
                      }
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileTransfer;
