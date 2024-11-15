import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import { Worker, Viewer } from '@react-pdf-viewer/core';
import '@react-pdf-viewer/core/lib/styles/index.css';

const socket = io('http://localhost:8082');

function App() {
  const [roomId, setRoomId] = useState('');
  const [inRoom, setInRoom] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [numPages, setNumPages] = useState(null);
  const pdfContainerRef = useRef(null);
  const isScrolling = useRef(false);

  const createRoom = () => {
    const newRoomId = Math.random().toString(36).substring(2, 8);
    setRoomId(newRoomId);
    socket.emit('createRoom', newRoomId);
    setInRoom(true);
    setIsOwner(true);
  };

  const joinRoom = () => {
    if (roomId) {
      socket.emit('joinRoom', roomId);
      setInRoom(true);
    }
  };

  const changePage = (newPageNumber) => {
    if (newPageNumber > 0 && newPageNumber <= numPages) {
      setPageNumber(newPageNumber);
      if (isOwner) {
        socket.emit('changePage', { roomId, pageNumber: newPageNumber });
      }
    }
  };

  const uploadPdf = async () => {
    if (pdfFile && roomId) {
      const formData = new FormData();
      formData.append('pdf', pdfFile);
      formData.append('roomId', roomId);
      try {
        const response = await axios.post('http://localhost:8082/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        setPdfUrl(response.data.pdfUrl);
        setPageNumber(1);
      } catch (error) {
        console.error('Error uploading PDF:', error);
      }
    }
  };

  useEffect(() => {
    socket.on('updatePage', (newPageNumber) => {
      setPageNumber(newPageNumber);
    });

    socket.on('pdfUploaded', (url) => {
      setPdfUrl(url);
      setPageNumber(1);
    });

    socket.on('updateScroll', (scrollTop) => {
      if (pdfContainerRef.current && !isOwner) {
        isScrolling.current = true;
        pdfContainerRef.current.scrollTo({ top: scrollTop, behavior: 'auto' });
        setTimeout(() => {
          isScrolling.current = false;
        }, 100);
      }
    });

    return () => {
      socket.off('updatePage');
      socket.off('pdfUploaded');
      socket.off('updateScroll');
    };
  }, [isOwner]);

  const handleScroll = () => {
    if (isOwner && pdfContainerRef.current && !isScrolling.current) {
      const scrollTop = pdfContainerRef.current.scrollTop;
      socket.emit('scrollPdf', { roomId, scrollTop });
    }
  };

  return (
    <div className="App">
      {!inRoom ? (
        <div>
          <button onClick={createRoom}>Create Room</button>
          <input
            type="text"
            placeholder="Enter Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <button onClick={joinRoom}>Join Room</button>
        </div>
      ) : (
        <div>
          <h2>Room ID: {roomId}</h2>
          {pdfUrl ? (
            <div
              ref={pdfContainerRef}
              onScroll={handleScroll}
              style={{ width: '100vw', height: '90vh', overflow: 'auto' }}
            >
              <Worker workerUrl={`https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`}>
                <Viewer fileUrl={pdfUrl} defaultScale={1.5} pageIndex={pageNumber - 1} />
              </Worker>
            </div>
          ) : (
            isOwner && (
              <div>
                <input type="file" accept="application/pdf" onChange={(e) => setPdfFile(e.target.files[0])} />
                <button onClick={uploadPdf}>Upload PDF</button>
              </div>
            )
          )}
          {isOwner && pdfUrl && (
            <div>
              <button onClick={() => changePage(pageNumber - 1)} disabled={pageNumber <= 1}>Previous Page</button>
              <span> Page {pageNumber} of {numPages || '...'} </span>
              <button onClick={() => changePage(pageNumber + 1)} disabled={pageNumber >= numPages}>Next Page</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;