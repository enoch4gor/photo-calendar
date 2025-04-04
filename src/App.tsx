import React, { useState, useRef, useCallback, useEffect } from 'react';
import { saveAs } from 'file-saver';
import PhotoEditor from './components/PhotoEditor';
import './App.css';

// Secret code for download verification
const SECRET_CODE = "CALPANION";
// Key for localStorage
const VERIFICATION_KEY = "photo_calendar_verified";

function App() {
  const [userImage, setUserImage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCodeDialog, setShowCodeDialog] = useState(false);
  const [secretCode, setSecretCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  
  const editorRef = useRef<HTMLDivElement>(null);
  const editorComponentRef = useRef<any>(null);

  // Check localStorage on component mount
  useEffect(() => {
    const verified = localStorage.getItem(VERIFICATION_KEY) === 'true';
    setIsVerified(verified);
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setUserImage(e.target.result as string);
          setIsEditing(true);
          setError(null); // Clear any previous errors
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const processDownload = useCallback(async () => {
    if (!editorComponentRef.current || !editorRef.current) {
      setError("The editor isn't ready yet. Please try again.");
      return;
    }
    
    // Clear any previous errors
    setError(null);
    
    try {
      setIsDownloading(true);
      
      // Get clean render of just the photo and calendar
      const cleanImage = await editorComponentRef.current.getCleanRender();
      
      // For mobile browsers, ensure the download happens with proper quality
      const isMobile = window.innerWidth <= 768;
      
      if (isMobile) {
        try {
          // Additional processing for mobile to ensure quality
          const fileName = 'photo-calendar.png';
          
          // Extract the image data with minimal processing
          const byteString = atob(cleanImage.split(',')[1]);
          const mimeType = cleanImage.split(',')[0].split(':')[1].split(';')[0];
          
          // Create a high-quality blob with minimal compression
          const arrayBuffer = new ArrayBuffer(byteString.length);
          const intArray = new Uint8Array(arrayBuffer);
          
          for (let i = 0; i < byteString.length; i++) {
            intArray[i] = byteString.charCodeAt(i);
          }
          
          // Use a high-quality PNG with no compression
          const blob = new Blob([arrayBuffer], { 
            type: 'image/png' // Force PNG format for best quality
          });
          
          console.log(`Download image size: ${Math.round(blob.size / 1024)} KB`);
          
          // For very small files (which might indicate quality issues),
          // fall back to a different approach
          if (blob.size < 100000) { // Less than 100KB is suspiciously small
            console.warn("Download image size is unusually small, trying alternative approach");
            
            // Create a download link and trigger it
            const link = document.createElement('a');
            link.href = cleanImage;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          } else {
            // Use the saveAs function with the blob for normal sized images
            saveAs(blob, fileName);
          }
        } catch (mobileError) {
          console.error('Error in mobile-specific download processing:', mobileError);
          
          // A more direct approach as fallback
          const link = document.createElement('a');
          link.href = cleanImage;
          link.download = 'photo-calendar.png';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } else {
        // Standard download for desktop
        saveAs(cleanImage, 'photo-calendar.png');
      }
    } catch (error) {
      console.error('Download failed:', error);
      setError("Failed to download the image. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  }, [setError, setIsDownloading]);

  const initiateDownload = useCallback(() => {
    // If already verified, proceed directly to download
    if (isVerified) {
      processDownload();
      return;
    }
    
    // Otherwise show the code dialog
    setShowCodeDialog(true);
    setSecretCode('');
    setCodeError(null);
  }, [isVerified, processDownload]);

  const verifyAndDownload = useCallback(async () => {
    // Verify secret code - make it case-insensitive
    if (secretCode.trim().toUpperCase() === SECRET_CODE.toUpperCase()) {
      // Store verification status in localStorage
      localStorage.setItem(VERIFICATION_KEY, 'true');
      setIsVerified(true);
      setShowCodeDialog(false);
      
      // Process the download
      processDownload();
    } else {
      // Show error for incorrect code
      setCodeError("Wrong secret code. Please get the correct code.");
    }
  }, [secretCode, processDownload]);

  const handleGetCode = useCallback(() => {
    // Open the Gumroad page in a new tab
    window.open('https://creaizi4.gumroad.com/l/photocalendar', '_blank');
  }, []);

  const handleBack = () => {
    setIsEditing(false);
    setUserImage(null);
    setError(null); // Clear any errors when going back
  };

  // Function to dismiss error messages
  const dismissError = () => {
    setError(null);
  };

  return (
    <div className="app mobile-scrollable">
      <header className="app-header">
        <h1>Photo Calendar Creator</h1>
      </header>
      <main className="app-content">
        {error && (
          <div className="error-message">
            <p>{error}</p>
            <button onClick={dismissError}>Dismiss</button>
          </div>
        )}
        {!isEditing ? (
          <div className="upload-container">
            <h2>Create Your Calendar</h2>
            <p>Upload a photo and add a calendar overlay to create your custom photo calendar.</p>
            <input
              type="file"
              accept="image/*"
              id="file-input"
              className="file-input"
              onChange={handleFileChange}
            />
            <label htmlFor="file-input" className="upload-button">
              Upload Photo
            </label>
          </div>
        ) : (
          <div className="editor-container">
            <div ref={editorRef} className="editor-area">
              <PhotoEditor 
                userImage={userImage || ''} 
                ref={editorComponentRef} 
                isDownloading={isDownloading}
              />
            </div>
            <div className="action-buttons">
              <button className="back-button" onClick={handleBack}>
                Back
              </button>
              <button 
                className="download-button" 
                onClick={initiateDownload}
                disabled={isDownloading}
              >
                {isDownloading ? 'Processing...' : 'Download'}
              </button>
            </div>
          </div>
        )}
        
        {/* Secret code verification dialog */}
        {showCodeDialog && (
          <div className="code-dialog-overlay">
            <div className="code-dialog">
              <h3>Secret Code Required</h3>
              <p>Please enter the secret code to download your calendar.</p>
              
              {codeError && (
                <div className="code-error">{codeError}</div>
              )}
              
              <input
                type="text"
                placeholder="Enter secret code"
                value={secretCode}
                onChange={(e) => setSecretCode(e.target.value)}
                className="code-input"
              />
              
              <div className="code-dialog-buttons">
                <button onClick={() => setShowCodeDialog(false)} className="cancel-button">
                  Cancel
                </button>
                <button onClick={verifyAndDownload} className="verify-button">
                  Download
                </button>
              </div>
              
              <div className="get-code-section">
                <p>Don't have a code?</p>
                <button onClick={handleGetCode} className="get-code-button">
                  Click to get secret code
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
