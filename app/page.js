'use client';
import React, { useState, useEffect } from "react";
import Peer from "peerjs";

// Function to generate a numeric peer ID
const generateNumericPeerId = () => {
  return Math.floor(Math.random() * 9000000) + 1000000; // Generates a 7-digit random number
};


const FileTransfer = () => {
  const [peer, setPeer] = useState(null);
  const [peerId, setPeerId] = useState("");
  const [targetPeerId, setTargetPeerId] = useState("");
  const [connection, setConnection] = useState(null);
  const [senderPeerId, setSenderPeerId] = useState(""); // State to store sender's peer ID
  const [isSender, setIsSender] = useState(false); // State to track if the peer is the sender
  const [receivedFile, setReceivedFile] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [fileName, setFilename] = useState("");
  const [transferProgress, setTransferProgress] = useState(0); // State to track file transfer progress
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
      setSenderPeerId(conn.peer); // Set the sender's peer ID state
      setIsSender(false); // Set as receiver

      let receivedChunks = [];
      let totalSize = 0;

      conn.on("data", (data) => {
        console.log("Data received:", data);
        if (data.type === "file-start") {
          // Notify the receiver about the incoming file transfer
          // showModal("Incoming File", `File name: ${data.fileName}`);
          setFilename(data.fileName);
          totalSize = data.size;
          receivedChunks = [];
        } else if (data.chunk) {
          receivedChunks.push(data.chunk);
          // Update transfer progress
          const receivedSize = receivedChunks.reduce((acc, chunk) => acc + chunk.byteLength, 0);
          const progress = Math.round((receivedSize / totalSize) * 100);
          setTransferProgress(progress);
          if (progress >= 100) {
            const fileBlob = new Blob(receivedChunks);
            const url = URL.createObjectURL(fileBlob);
            setReceivedFile(data.fileName);
            setDownloadUrl(url);
            // showModal("File Received", `File name: ${data.fileName}`);
            console.log(`File received: ${data.fileName}, URL: ${url}`);
          }
        } else if (data.type === "progress") {
          setTransferProgress(Math.min(data.progress, 100)); // Ensure progress does not exceed 100%
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
      setSenderPeerId(targetPeerId); // Set the target peer ID as the sender's ID
      setIsSender(true); // Set as sender
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
    connection.send({ type: "file-start", fileName: file.name, size: file.size });

    // showModal("Starting File Transfer", `File name: ${file.name}`);
    setFilename(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result;
      const chunkSize = 16 * 1024; // 16KB chunks
      let offset = 0;

      function sendChunk() {
        const chunk = arrayBuffer.slice(offset, offset + chunkSize);
        connection.send({ type: "file-chunk", fileName: file.name, chunk });
        offset += chunkSize;

        // Update transfer progress
        const progress = Math.round((offset / arrayBuffer.byteLength) * 100);
        setTransferProgress(progress);
        connection.send({ type: "progress", progress });

        if (offset < arrayBuffer.byteLength) {
          setTimeout(sendChunk, 0);
        } else {
          console.log("File transfer completed.");
          setTransferProgress(100); // Ensure progress is set to 100% on completion
        }
      }

      sendChunk();
    };
    reader.readAsArrayBuffer(file); // Read the file as an array buffer
  };

  return (
    <div className="h-screen flex items-center justify-center ">
      <div id="App" className="mockup-browser border w-11/12 h-5/6">
        <div className="mockup-browser-toolbar">
          <div className="input">{"https://" + window.location.hostname}</div>
        </div>
        <div className="flex justify-center px-4 py-16 bg-base-200 h-full">
          <div className="p-6">
            <div className="flex gap-4 items-center">
              <h2 className="text-2xl font-bold mb-4">Your Peer ID: {peerId}</h2>
              {!peerId && <span class="loading loading-dots loading-md"></span>}
            </div>
            {senderPeerId && (
              <h3 className="text-xl font-bold mb-4">
                {isSender ? "Connected to" : "Connected from"}: {senderPeerId}
              </h3>
            )}
            <div className="mb-4">
              <input
                type="number"
                placeholder="Enter peer ID"
                value={targetPeerId}
                onChange={(e) => setTargetPeerId(e.target.value)} // Update target peer ID state on input change
                className="input input-bordered w-full mb-2"
              />
              <button
                onClick={connectToPeer}
                className="btn btn-primary w-full mb-2"
              >
                Connect
              </button>
              <input
                type="file"
                onChange={(e) => e.target.files && sendFile(e.target.files[0])}
                className="file-input file-input-bordered w-full"
              />
            </div>
            {transferProgress > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-xl font-bold">
                  {isSender ? "Sending" : "Incoming"} {fileName}: {transferProgress}%
                </h3>
                <progress className="progress" value={transferProgress} max="100"></progress>
              </div>
            )}
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
