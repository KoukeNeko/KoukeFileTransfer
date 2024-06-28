'use client';
import React, { useState, useEffect } from "react";
import Peer from "peerjs";

// Generate a 7-digit random number as peer ID
const generateNumericPeerId = () => {
  return Math.floor(Math.random() * 9000000) + 1000000;
};

const FileTransfer = () => {
  // State variables definition
  const [peer, setPeer] = useState(null);                  // PeerJS instance
  const [peerId, setPeerId] = useState("");                // Current peer's ID
  const [targetPeerId, setTargetPeerId] = useState("");    // Target peer's ID
  const [connection, setConnection] = useState(null);      // Connection with other peer
  const [senderPeerId, setSenderPeerId] = useState("");    // Sender's peer ID
  const [isSender, setIsSender] = useState(false);         // Whether this peer is the sender
  const [receivedFile, setReceivedFile] = useState(null);  // Received file name
  const [downloadUrl, setDownloadUrl] = useState("");      // URL for downloading the file
  const [fileName, setFilename] = useState("");            // Current file name being processed
  const [transferProgress, setTransferProgress] = useState(0); // Transfer progress
  const [modalState, setModalState] = useState({           // Modal state
    isModalOpen: false,
    title: "",
    message: "",
  });

  // Function to show the modal
  const showModal = (title, message) => {
    setModalState({ isModalOpen: true, title, message });
  };

  useEffect(() => {
    // Generate new peer ID and initialize PeerJS
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

    // Set peer ID when peer connection is successful
    newPeer.on("open", (id) => {
      console.log("Peer ID:", id);
      setPeerId(id);
    });

    // Handle received connections
    newPeer.on("connection", (conn) => {
      console.log("Connection received from:", conn.peer);
      setSenderPeerId(conn.peer);
      setIsSender(false);

      let receivedChunks = [];
      let totalSize = 0;

      // Handle received data
      conn.on("data", (data) => {
        console.log("Data received:", data);
        if (data.type === "file-start") {
          // Start receiving new file
          setFilename(data.fileName);
          totalSize = data.size;
          receivedChunks = [];
        } else if (data.chunk) {
          // Receive file chunk
          receivedChunks.push(data.chunk);
          const receivedSize = receivedChunks.reduce((acc, chunk) => acc + chunk.byteLength, 0);
          const progress = Math.round((receivedSize / totalSize) * 100);
          setTransferProgress(progress);
          if (progress >= 100) {
            // File reception complete, create Blob and generate download URL
            const fileBlob = new Blob(receivedChunks);
            const url = URL.createObjectURL(fileBlob);
            setReceivedFile(data.fileName);
            setDownloadUrl(url);
            console.log(`File received: ${data.fileName}, URL: ${url}`);
          }
        } else if (data.type === "progress") {
          // Update transfer progress
          setTransferProgress(Math.min(data.progress, 100));
        }
      });

      setConnection(conn);
    });

    // Handle disconnection
    newPeer.on("disconnected", () => {
      console.warn("Connection lost. Attempting to reconnect...");
      newPeer.reconnect();
    });

    // Handle connection closure
    newPeer.on("close", () => {
      console.warn("Connection destroyed.");
    });

    // Handle errors
    newPeer.on("error", (err) => {
      console.error("PeerJS Error:", err);
    });

    setPeer(newPeer);

    // Clean up PeerJS instance when component unmounts
    return () => {
      newPeer.destroy();
    };
  }, []);

  // Connect to target peer
  const connectToPeer = () => {
    if (!peer) {
      console.error("Peer instance not initialized.");
      return;
    }

    console.log("Connecting to peer:", targetPeerId);
    const conn = peer.connect(targetPeerId);

    conn.on("open", () => {
      console.log("Connection opened");
      setConnection(conn);
      setSenderPeerId(targetPeerId);
      setIsSender(true);
    });

    conn.on("error", (err) => {
      console.error("Connection error:", err);
    });
  };

  // Send file
  const sendFile = (file) => {
    if (!connection) {
      showModal("Error", "No connection established.");
      return;
    }

    // Notify receiver about the start of file transfer
    connection.send({ type: "file-start", fileName: file.name, size: file.size });
    setFilename(file.name);

    const chunkSize = 64 * 1024; // 64KB chunk size
    let offset = 0;
    let reader = new FileReader();

    // Read next file chunk
    const readNextChunk = () => {
      const slice = file.slice(offset, offset + chunkSize);
      reader.readAsArrayBuffer(slice);
    };

    // Handle file chunk load completion event
    reader.onload = (event) => {
      if (event.target.result) {
        // Send file chunk
        connection.send({ type: "file-chunk", fileName: file.name, chunk: event.target.result });
        offset += event.target.result.byteLength;
        const progress = Math.round((offset / file.size) * 100);
        setTransferProgress(progress);
        connection.send({ type: "progress", progress });

        if (offset < file.size) {
          // If there's remaining part, continue reading next chunk
          readNextChunk();
        } else {
          // File transfer complete
          console.log("File transfer completed.");
          setTransferProgress(100);
        }
      }
    };

    // Handle file read error
    reader.onerror = (error) => {
      console.error("Error reading file:", error);
      showModal("Error", "Failed to read file.");
    };

    // Start reading the file
    readNextChunk();
  };

  // Render UI
  return (
    <div className="h-screen flex items-center justify-center ">
      <div id="App" className="mockup-browser border w-11/12 h-5/6">
        <div className="mockup-browser-toolbar">
          <div className="input">{typeof window !== "undefined" && window.location.href}</div>
        </div>
        <div className="flex justify-center px-4 py-16 bg-base-200 h-full">
          <div className="p-6">
            {/* Display current peer ID */}
            <div className="flex gap-4 items-center">
              <h2 className="text-2xl font-bold mb-4">Your Peer ID: {peerId}</h2>
              {!peerId && <span className="loading loading-dots loading-md"></span>}
            </div>
            {/* Display connection status */}
            {senderPeerId && (
              <h3 className="text-xl font-bold mb-4">
                {isSender ? "Connected to" : "Connected from"}: {senderPeerId}
              </h3>
            )}
            <div className="mb-4">
              {/* Input for target peer ID */}
              <input
                type="number"
                placeholder="Enter peer ID"
                value={targetPeerId}
                onChange={(e) => setTargetPeerId(e.target.value)}
                className="input input-bordered w-full mb-2"
              />
              {/* Connect button */}
              <button
                onClick={connectToPeer}
                className="btn btn-primary w-full mb-2"
              >
                Connect
              </button>
              {/* File selection input */}
              <input
                type="file"
                onChange={(e) => e.target.files && sendFile(e.target.files[0])}
                className="file-input file-input-bordered w-full"
              />
            </div>
            {/* Display transfer progress */}
            {transferProgress > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-xl font-bold">
                  {isSender ? "Sending" : "Incoming"} {fileName}: {transferProgress}%
                </h3>
                <progress className="progress" value={transferProgress} max="100"></progress>
              </div>
            )}
            {/* Display download option for received file */}
            {receivedFile && (
              <div className="mt-4">
                <h3 className="text-xl font-bold">File received: {receivedFile}</h3>
                <a
                  href={downloadUrl}
                  download={receivedFile}
                  className="btn btn-secondary mt-2"
                >
                  Download
                </a>
              </div>
            )}

            {/* Modal */}
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
