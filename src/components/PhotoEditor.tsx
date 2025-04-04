import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle, useMemo } from 'react';
import { Stage, Layer, Image as KonvaImage, Transformer, Group, Rect } from 'react-konva';
import useImage from 'use-image';
import CalendarGenerator from './CalendarGenerator';
import './PhotoEditor.css';

interface PhotoEditorProps {
  userImage: string;
  isDownloading?: boolean;
}

// Font options available in the application
const AVAILABLE_FONTS = [
  { name: 'Shooting Star', value: 'Shooting Star' },
  { name: 'Have Idea', value: 'Have Idea' },
  { name: 'Always Forever', value: 'Always Forever' },
  { name: 'Pacifico', value: 'Pacifico' },
  { name: 'Yellowtail', value: 'Yellowtail' }
];

// Color options for the font
const DEFAULT_COLORS = [
  { name: 'White', value: '#ffffff' },
  { name: 'Black', value: '#000000' },
  { name: 'Blue', value: '#1e90ff' },
  { name: 'Green', value: '#00aa55' },
  { name: 'Purple', value: '#9900ff' },
  { name: 'Yellow', value: '#ffff00' }
];

// Photo filter options (Instagram-like)
const PHOTO_FILTERS = [
  { name: 'None', value: 'none', style: {} },
  { 
    name: 'Clarendon', 
    value: 'clarendon',
    style: {
      filter: 'contrast(1.2) saturate(1.35) brightness(1.1)'
    } 
  },
  { 
    name: 'Gingham', 
    value: 'gingham',
    style: {
      filter: 'brightness(1.05) hue-rotate(-10deg) sepia(0.2)'
    } 
  },
  { 
    name: 'Juno', 
    value: 'juno',
    style: {
      filter: 'sepia(0.35) contrast(1.15) brightness(1.15) saturate(1.8)'
    } 
  }
];

// Helper to detect iOS devices
const isIOS = () => {
  return [
    'iPad Simulator',
    'iPhone Simulator',
    'iPod Simulator',
    'iPad',
    'iPhone',
    'iPod'
  ].includes(navigator.platform)
  // iPad on iOS 13 detection
  || (navigator.userAgent.includes("Mac") && "ontouchend" in document);
};

// Helper to detect Android devices
const isAndroid = () => {
  return /Android/i.test(navigator.userAgent);
};

// Helper to detect mobile Chrome
const isMobileChrome = () => {
  return /Chrome/i.test(navigator.userAgent) && 
    (/Android/i.test(navigator.userAgent) || /iPhone|iPad|iPod/i.test(navigator.userAgent));
};

// Helper to detect mobile Safari
const isMobileSafari = () => {
  return /Safari/i.test(navigator.userAgent) && 
    !/Chrome/i.test(navigator.userAgent) && 
    (/iPhone|iPad|iPod/i.test(navigator.userAgent));
};

// Helper to ensure image is loaded before drawing
const ensureImageLoaded = (image: HTMLImageElement): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    if (!image) {
      reject(new Error('No image provided'));
      return;
    }
    
    if (image.complete && image.naturalWidth > 0) {
      resolve(image);
      return;
    }
    
    const onLoad = () => {
      image.removeEventListener('load', onLoad);
      image.removeEventListener('error', onError);
      resolve(image);
    };
    
    const onError = (error: Event | null) => {
      image.removeEventListener('load', onLoad);
      image.removeEventListener('error', onError);
      reject(error || new Error('Image failed to load'));
    };
    
    image.addEventListener('load', onLoad);
    image.addEventListener('error', onError);
    
    // Set a timeout in case the image never loads
    setTimeout(() => {
      if (!image.complete) {
        onError(null);
      }
    }, 3000);
  });
};

const PhotoEditor = forwardRef<any, PhotoEditorProps>(({ userImage, isDownloading = false }, ref) => {
  const [photoSize, setPhotoSize] = useState({ width: 800, height: 600 });
  const [calendarDataUrl, setCalendarDataUrl] = useState<string>('');
  const [calendarAttrs, setCalendarAttrs] = useState({
    x: 50,
    y: 50,
    width: 400,
    height: 350,
    id: 'calendar',
  });
  const [isSelected, setIsSelected] = useState(false);
  const [userImg] = useImage(userImage);
  const [calendarImage] = useImage(calendarDataUrl);
  const transformerRef = React.useRef<any>(null);
  const calendarRef = React.useRef<any>(null);
  const stageRef = React.useRef<any>(null);
  
  // Font customization states
  const [selectedFont, setSelectedFont] = useState('Shooting Star');
  const [selectedColor, setSelectedColor] = useState(DEFAULT_COLORS[0].value);
  
  // Photo filter state
  const [selectedFilter, setSelectedFilter] = useState(PHOTO_FILTERS[0].value);
  
  // Add a state to track mobile view
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  // Add iOS detection
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  const [isAndroidDevice, setIsAndroidDevice] = useState(false);
  const [isMobileChromeDevice, setIsMobileChromeDevice] = useState(false);
  const [isMobileSafariDevice, setIsMobileSafariDevice] = useState(false);
  
  // Add the filtered image state
  const [filteredImage, setFilteredImage] = useState<string | null>(null);
  
  // Check if it's an iOS device on mount
  useEffect(() => {
    setIsIOSDevice(isIOS());
    setIsAndroidDevice(isAndroid());
    setIsMobileChromeDevice(isMobileChrome());
    setIsMobileSafariDevice(isMobileSafari());
  }, []);
  
  // Update mobile state on resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Expose methods to parent component through ref
  useImperativeHandle(ref, () => ({
    getCleanRender: () => {
      // Make sure we have the stage ref
      if (!stageRef.current) {
        console.error('Stage reference is null');
        return Promise.reject(new Error('Stage reference is null'));
      }
      
      // Temporarily deselect the calendar to hide transformation handles
      const wasSelected = isSelected;
      if (wasSelected) {
        setIsSelected(false);
      }
      
      // Return a promise that resolves with the image data
      return new Promise<string>((resolve, reject) => {
        // Use setTimeout to ensure the UI updates before taking the screenshot
        setTimeout(() => {
          try {
            // For mobile devices, use an extreme pixel ratio to ensure high quality
            // Calculate based on both device pixel ratio and screen size
            const basePixelRatio = window.devicePixelRatio || 1;
            const screenWidth = window.innerWidth;
            
            // For smaller screens, use an even higher pixel ratio (6-8) for better quality
            // Adjust based on screen size to prevent memory issues on very large screens
            let exportPixelRatio = 3; // Default for desktop
            
            if (isMobile) {
              if (screenWidth <= 375) {
                // Small phones (iPhone SE, etc.)
                exportPixelRatio = 8;
              } else if (screenWidth <= 428) {
                // Medium phones (iPhone 12/13/14, etc.)
                exportPixelRatio = 7;
              } else if (screenWidth <= 768) {
                // Large phones and small tablets
                exportPixelRatio = 6;
              }
            }
            
            console.log(`Screen width: ${screenWidth}px, Device pixel ratio: ${basePixelRatio}, Export pixel ratio: ${exportPixelRatio}`);
            
            const captureCanvas = async () => {
              // ======== APPROACH #1: Direct Stage Export ========
              // This fails on some mobile browsers that limit canvas size
              try {
                // Get the data URL of the stage with the filtered image
                const dataUrl = stageRef.current.toDataURL({
                  pixelRatio: exportPixelRatio,
                  mimeType: 'image/png',
                  quality: 1
                });
                
                // If we get here without errors, we can use this approach for some devices
                if (!(isMobile || isIOSDevice || isAndroidDevice)) {
                  // For desktop, this approach works reliably
                  return dataUrl;
                }
                
                // For mobile, we'll proceed with additional approaches
                // but keep this result as a fallback
                let fallbackDataUrl = dataUrl;
                
                // ======== APPROACH #2: Manual Render for Mobile ========
                const stage = stageRef.current;
                const stageWidth = stage.width();
                const stageHeight = stage.height();
                
                // Create an off-screen canvas with dimensions scaled up for high resolution
                const offscreenCanvas = document.createElement('canvas');
                const ctx = offscreenCanvas.getContext('2d', {
                  alpha: true,
                  willReadFrequently: true
                });
                
                // Set canvas size to be much larger for extremely high quality
                const targetWidth = stageWidth * exportPixelRatio;
                const targetHeight = stageHeight * exportPixelRatio;
                
                // Check if we need to use a more conservative size based on device limitations
                // Safari and some mobile browsers have canvas size limits
                const maxDimension = 4096; // Some devices have a 4096px limit
                
                // If target dimensions exceed limits, scale down while maintaining aspect ratio
                let finalWidth = targetWidth;
                let finalHeight = targetHeight;
                
                if (targetWidth > maxDimension || targetHeight > maxDimension) {
                  const scaleFactor = Math.min(maxDimension / targetWidth, maxDimension / targetHeight);
                  finalWidth = targetWidth * scaleFactor;
                  finalHeight = targetHeight * scaleFactor;
                  console.log(`Canvas size reduced due to browser limitations: ${finalWidth}x${finalHeight}`);
                }
                
                offscreenCanvas.width = finalWidth;
                offscreenCanvas.height = finalHeight;
                
                if (!ctx) {
                  console.error('Could not get canvas context');
                  return fallbackDataUrl;
                }
                
                // Clear the canvas with the same background color as the stage
                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
                
                // ======== APPROACH #3: Manual Drawing of Elements ========
                // This is the most reliable approach for mobile
                
                try {
                  // First check if displayImage is properly loaded
                  if (!displayImage) {
                    console.error('Display image not available');
                    return fallbackDataUrl;
                  }
                  
                  // Ensure image is properly loaded
                  await ensureImageLoaded(displayImage);
                  console.log(`Using image: width=${displayImage.width}, height=${displayImage.height}, complete=${displayImage.complete}`);
                  
                  // Scale the image to fill the canvas
                  const scaleX = finalWidth / stageWidth;
                  const scaleY = finalHeight / stageHeight;
                  
                  // First, draw the base image
                  ctx.save();
                  
                  // Apply the filter directly to the canvas context if needed
                  if (selectedFilter !== 'none') {
                    const filterStyle = PHOTO_FILTERS.find(f => f.value === selectedFilter)?.style.filter;
                    if (filterStyle) {
                      ctx.filter = filterStyle;
                    }
                  }
                  
                  // Draw the image at the scaled size
                  ctx.drawImage(
                    displayImage,
                    0, 0, stageWidth, stageHeight, // Source rectangle
                    0, 0, finalWidth, finalHeight  // Destination rectangle
                  );
                  
                  ctx.restore();
                  console.log('Successfully drew background image to canvas');
                  
                  // Draw the calendar image if available
                  if (calendarImage) {
                    await ensureImageLoaded(calendarImage);
                    
                    // Calculate the scaled position and size of the calendar
                    const calX = calendarAttrs.x * scaleX;
                    const calY = calendarAttrs.y * scaleY;
                    const calWidth = calendarAttrs.width * scaleX;
                    const calHeight = calendarAttrs.height * scaleY;
                    
                    // Add shadow for the calendar
                    ctx.save();
                    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
                    ctx.shadowBlur = 18 * Math.min(scaleX, scaleY);
                    ctx.shadowOffsetX = 4 * scaleX;
                    ctx.shadowOffsetY = 4 * scaleY;
                    
                    // Draw the calendar
                    ctx.drawImage(
                      calendarImage,
                      0, 0, calendarImage.width, calendarImage.height, // Source rectangle
                      calX, calY, calWidth, calHeight  // Destination rectangle
                    );
                    
                    ctx.restore();
                    console.log('Successfully drew calendar to canvas');
                  }
                  
                  // Use PNG format with maximum quality for best results
                  const highQualityDataUrl = offscreenCanvas.toDataURL('image/png', 1.0);
                  console.log(`Generated high quality image: ${Math.round(highQualityDataUrl.length / 1024)} KB`);
                  
                  // Verify the data URL isn't suspiciously small (which might indicate a failed render)
                  if (highQualityDataUrl.length < 10000) {
                    console.warn('Generated image seems too small, falling back to direct capture');
                    return fallbackDataUrl;
                  }
                  
                  return highQualityDataUrl;
                } catch (drawError) {
                  console.error('Error during manual canvas drawing:', drawError);
                  return fallbackDataUrl;
                }
              } catch (stageExportError) {
                console.error('Error with direct stage export:', stageExportError);
                
                // Fallback to a simpler approach if everything else fails
                try {
                  const simpleDataUrl = stageRef.current.toDataURL({
                    pixelRatio: Math.min(4, exportPixelRatio), // Use a more conservative value
                    mimeType: 'image/png',
                    quality: 1
                  });
                  
                  return simpleDataUrl;
                } catch (fallbackError) {
                  console.error('Error with fallback export:', fallbackError);
                  throw new Error('Failed to export image');
                }
              }
            };
            
            // Execute the canvas capture with proper error handling
            captureCanvas()
              .then(dataUrl => {
                if (wasSelected) {
                  setIsSelected(true);
                }
                resolve(dataUrl);
              })
              .catch(error => {
                console.error('Canvas capture failed:', error);
                if (wasSelected) {
                  setIsSelected(true);
                }
                reject(error);
              });
          } catch (error) {
            console.error('Error generating image:', error);
            // Restore selection state if needed
            if (wasSelected) {
              setIsSelected(true);
            }
            reject(error);
          }
        }, 300); // Increased timeout to ensure UI updates
      });
    }
  }));
  
  // Get current month and year for the calendar
  const currentDate = new Date();
  const [calendarMonth, setCalendarMonth] = useState(currentDate.getMonth());
  const [calendarYear, setCalendarYear] = useState(currentDate.getFullYear());

  // Handle calendar generation
  const handleCalendarGenerated = useCallback((dataUrl: string) => {
    setCalendarDataUrl(dataUrl);
  }, []);

  // Change month
  const changeMonth = (delta: number) => {
    let newMonth = calendarMonth + delta;
    let newYear = calendarYear;
    
    if (newMonth > 11) {
      newMonth = 0;
      newYear += 1;
    } else if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    }
    
    setCalendarMonth(newMonth);
    setCalendarYear(newYear);
  };

  // Handle font change
  const handleFontChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedFont(e.target.value);
  };

  // Handle color change
  const handleColorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedColor(e.target.value);
  };

  // Handle filter change
  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedFilter(e.target.value);
  };

  // Keep calendar within bounds
  const keepCalendarWithinBounds = (newAttrs: any) => {
    const { x, y, width, height } = newAttrs;
    const { width: stageWidth, height: stageHeight } = photoSize;
    
    // Initialize constrained values
    let constrainedX = x;
    let constrainedY = y;
    
    // Constrain X position
    if (x < 0) {
      constrainedX = 0;
    } else if (x + width > stageWidth) {
      constrainedX = Math.max(0, stageWidth - width);
    }
    
    // Constrain Y position
    if (y < 0) {
      constrainedY = 0;
    } else if (y + height > stageHeight) {
      constrainedY = Math.max(0, stageHeight - height);
    }
    
    return {
      ...newAttrs,
      x: constrainedX,
      y: constrainedY
    };
  };

  // Update the filtered image whenever user image or filter changes
  useEffect(() => {
    if (!userImage) return;

    // Create a filtered version of the image
    const filter = PHOTO_FILTERS.find(f => f.value === selectedFilter);
    if (!filter || selectedFilter === 'none') {
      setFilteredImage(null);
      return;
    }
    
    // Skip canvas filtering for iOS Chrome - we know it's problematic
    // Just use CSS filters directly for all iOS browsers
    if (isIOSDevice) {
      console.log('iOS device detected - skipping canvas filtering');
      setFilteredImage(null);
      return;
    }

    // Create new image and ensure it loads properly
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    
    // Set up error handling
    const handleImageError = () => {
      console.error('Error loading image for filtering');
      setFilteredImage(null);
    };
    
    img.onerror = handleImageError;
    
    img.onload = () => {
      try {
        // Create a canvas with proper dimensions
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          console.error('Could not get canvas context');
          setFilteredImage(null);
          return;
        }

        // Draw the original image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Get filter style
        const filterStyle = filter.style.filter || '';
        
        if (!filterStyle) {
          setFilteredImage(null);
          return;
        }
        
        // Direct filter application without using a second image
        // This is more reliable on mobile
        ctx.filter = filterStyle;
        
        // Create a temporary canvas for the filtered image
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
        
        if (!tempCtx) {
          console.error('Could not get temp canvas context');
          setFilteredImage(null);
          return;
        }
        
        // Draw the original image on the temp canvas with the filter applied
        tempCtx.filter = filterStyle;
        tempCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
        
        // Get the filtered image data URL
        try {
          const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.92);
          setFilteredImage(dataUrl);
        } catch (error) {
          console.error('Error creating data URL:', error);
          setFilteredImage(null);
        }
      } catch (error) {
        console.error('Error applying filter:', error);
        setFilteredImage(null);
      }
    };
    
    // Set a timeout to handle potential image loading issues
    const timeout = setTimeout(() => {
      if (!filteredImage) {
        console.warn('Image filtering timed out, using original image');
        setFilteredImage(null);
      }
    }, 3000);
    
    // Start loading the image
    img.src = userImage;
    
    return () => {
      clearTimeout(timeout);
      img.onload = null;
      img.onerror = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userImage, selectedFilter, isIOSDevice, isAndroidDevice, isMobileChromeDevice, isMobileSafariDevice]);

  // Use the filtered image if available
  const [displayImage] = useImage(filteredImage || userImage);

  useEffect(() => {
    if (userImg) {
      // Resize the stage based on the loaded image (maintaining aspect ratio)
      // For mobile, use a smaller maximum width to ensure the image fits well
      const maxWidth = isMobile ? window.innerWidth * 0.95 : window.innerWidth * 0.8;
      const maxHeight = isMobile ? window.innerHeight * 0.35 : window.innerHeight * 0.6; // Slightly smaller for mobile fixed view
      
      let width = userImg.width;
      let height = userImg.height;
      
      if (width > maxWidth) {
        const ratio = maxWidth / width;
        width = maxWidth;
        height = height * ratio;
      }
      
      if (height > maxHeight) {
        const ratio = maxHeight / height;
        height = height * ratio;
        width = width * ratio;
      }
      
      setPhotoSize({ width, height });
      
      // Resize calendar to fit within the photo frame
      // Set calendar to approximately 60% of the photo size
      const calendarWidth = Math.min(width * 0.6, 600);
      const aspectRatio = 850 / 1000; // Height to width ratio of calendar
      const calendarHeight = calendarWidth * aspectRatio;
      
      // Position calendar in the center of the photo
      const calendarX = (width - calendarWidth) / 2;
      const calendarY = (height - calendarHeight) / 2;
      
      // Use functional update to avoid dependency on calendarAttrs
      setCalendarAttrs(prevAttrs => ({
        ...prevAttrs,
        x: calendarX,
        y: calendarY,
        width: calendarWidth,
        height: calendarHeight,
      }));
    }
  }, [userImg, isMobile]);

  useEffect(() => {
    if (isSelected && transformerRef.current && calendarRef.current) {
      // Check if the node is valid before attaching
      try {
        // Make sure calendarRef.current is properly initialized
        if (calendarRef.current.getLayer()) {
          transformerRef.current.nodes([calendarRef.current]);
          transformerRef.current.getLayer().batchDraw();
        }
      } catch (error) {
        console.error('Error attaching transformer:', error);
        // If there's an error, deselect to prevent further errors
        setIsSelected(false);
      }
    }
  }, [isSelected]);

  const handleSelect = useCallback(() => {
    setIsSelected(true);
    
    // Use setTimeout to ensure the state update happens before trying to attach
    setTimeout(() => {
      try {
        if (transformerRef.current && calendarRef.current && calendarRef.current.getLayer()) {
          transformerRef.current.nodes([calendarRef.current]);
          transformerRef.current.getLayer().batchDraw();
        }
      } catch (error) {
        console.error('Error setting up transformer after click:', error);
      }
    }, 0);
  }, []);

  const handleDeselect = (e: any) => {
    // Deselect when clicking on the stage but not on the calendar
    if (e.target === e.target.getStage()) {
      setIsSelected(false);
    }
  };

  const handleTransformEnd = () => {
    try {
      if (calendarRef.current) {
        const node = calendarRef.current;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        
        // Update the state with new dimensions and reset scale
        const newAttrs = {
          ...calendarAttrs,
          x: node.x(),
          y: node.y(),
          width: Math.min(node.width() * scaleX, photoSize.width),
          height: Math.min(node.height() * scaleY, photoSize.height),
        };
        
        // Ensure the calendar stays within bounds
        const constrainedAttrs = keepCalendarWithinBounds(newAttrs);
        
        setCalendarAttrs(constrainedAttrs);
        
        // Reset scale to avoid accumulation
        node.scaleX(1);
        node.scaleY(1);
        
        // Update all children to match the new size
        const children = node.getChildren();
        children.forEach((child: any) => {
          child.width(constrainedAttrs.width);
          child.height(constrainedAttrs.height);
        });
      }
    } catch (error) {
      console.error('Error during transform end:', error);
    }
  };

  // Get current filter style to apply
  const currentFilterStyle = useMemo(() => {
    if (selectedFilter === 'none') return {};
    const filter = PHOTO_FILTERS.find(f => f.value === selectedFilter);
    return filter?.style || {};
  }, [selectedFilter]);

  return (
    <div className="editor-layout">
      <div 
        className="canvas-container"
        style={isIOSDevice ? currentFilterStyle : {}}
      >
        <Stage 
          ref={stageRef}
          width={photoSize.width} 
          height={photoSize.height} 
          onClick={handleDeselect}
          onTap={handleDeselect}
          style={{ background: '#1a1a1a' }}
          pixelRatio={window.devicePixelRatio || 3}
          imageSmoothingEnabled={false}
          perfectDrawEnabled={true}
        >
          <Layer>
            {/* Use displayImage instead of userImg to show the filtered version */}
            {displayImage && (
              <KonvaImage 
                id="userPhoto"
                image={displayImage} 
                width={photoSize.width}
                height={photoSize.height}
                /* Apply CSS filter directly on iOS or as fallback if no filteredImage is available */
                {...((isIOSDevice || (!filteredImage && selectedFilter !== 'none')) ? {
                  globalCompositeOperation: 'source-over',
                  ...PHOTO_FILTERS.find(f => f.value === selectedFilter)?.style
                } : {})}
              />
            )}
            {calendarImage && (
              <Group
                x={calendarAttrs.x}
                y={calendarAttrs.y}
                width={calendarAttrs.width}
                height={calendarAttrs.height}
                draggable={!isDownloading}
                onClick={handleSelect}
                onTap={handleSelect}
                onMouseEnter={(e) => {
                  // Change cursor to indicate it's selectable
                  const container = e.target.getStage()?.container();
                  if (container) {
                    container.style.cursor = 'pointer';
                  }
                  // Add a class to the stage container to show the calendar is selectable
                  if (e.target.getStage()?.container()) {
                    e.target.getStage()?.container().classList.add('calendar-selectable');
                  }
                }}
                onMouseLeave={(e) => {
                  // Reset cursor
                  const container = e.target.getStage()?.container();
                  if (container) {
                    container.style.cursor = 'default';
                  }
                  // Remove the class
                  if (e.target.getStage()?.container()) {
                    e.target.getStage()?.container().classList.remove('calendar-selectable');
                  }
                }}
                onDblClick={() => {
                  setIsSelected(true);
                  
                  setTimeout(() => {
                    try {
                      if (transformerRef.current && calendarRef.current && calendarRef.current.getLayer()) {
                        transformerRef.current.nodes([calendarRef.current]);
                        transformerRef.current.getLayer().batchDraw();
                      }
                    } catch (error) {
                      console.error('Error setting up transformer after double-click:', error);
                    }
                  }, 0);
                }}
                onDblTap={() => {
                  setIsSelected(true);
                  
                  setTimeout(() => {
                    try {
                      if (transformerRef.current && calendarRef.current && calendarRef.current.getLayer()) {
                        transformerRef.current.nodes([calendarRef.current]);
                        transformerRef.current.getLayer().batchDraw();
                      }
                    } catch (error) {
                      console.error('Error setting up transformer after double-tap:', error);
                    }
                  }, 0);
                }}
                onDragEnd={(e) => {
                  try {
                    const newAttrs = {
                      ...calendarAttrs,
                      x: e.target.x(),
                      y: e.target.y(),
                    };
                    
                    // Ensure the calendar stays within bounds
                    const constrainedAttrs = keepCalendarWithinBounds(newAttrs);
                    setCalendarAttrs(constrainedAttrs);
                    
                    // Update the node position if it was constrained
                    if (e.target.x() !== constrainedAttrs.x || e.target.y() !== constrainedAttrs.y) {
                      e.target.position({
                        x: constrainedAttrs.x,
                        y: constrainedAttrs.y
                      });
                    }
                  } catch (error) {
                    console.error('Error during drag end:', error);
                  }
                }}
                onTransformEnd={handleTransformEnd}
                ref={calendarRef}
              >
                {/* Invisible rectangle that covers the entire calendar area to improve hit detection */}
                <Rect
                  width={calendarAttrs.width}
                  height={calendarAttrs.height}
                  fill="rgba(0,0,0,0.01)"
                  strokeWidth={0}
                  listening={true}
                />
                {/* The calendar image */}
                <KonvaImage
                  image={calendarImage}
                  width={calendarAttrs.width}
                  height={calendarAttrs.height}
                  shadowColor="rgba(0, 0, 0, 0.85)"
                  shadowBlur={18}
                  shadowOffsetX={4}
                  shadowOffsetY={4}
                  shadowOpacity={0.8}
                  imageSmoothingEnabled={false}
                  perfectDrawEnabled={true}
                  pixelRatio={3}
                  listening={true}
                />
              </Group>
            )}
            {isSelected && !isDownloading && calendarRef.current && (
              <Transformer
                ref={transformerRef}
                boundBoxFunc={(oldBox, newBox) => {
                  // Limit resize to a minimum size
                  if (newBox.width < 50 || newBox.height < 50) {
                    return oldBox;
                  }
                  
                  // Limit resize to fit within the stage
                  if (
                    newBox.x < 0 ||
                    newBox.y < 0 ||
                    newBox.x + newBox.width > photoSize.width ||
                    newBox.y + newBox.height > photoSize.height
                  ) {
                    // If out of bounds, constrain to fit
                    const constrainedBox = { ...newBox };
                    
                    // Constrain width and position
                    if (newBox.x < 0) {
                      constrainedBox.width += newBox.x;
                      constrainedBox.x = 0;
                    }
                    if (newBox.x + newBox.width > photoSize.width) {
                      constrainedBox.width = photoSize.width - newBox.x;
                    }
                    
                    // Constrain height and position
                    if (newBox.y < 0) {
                      constrainedBox.height += newBox.y;
                      constrainedBox.y = 0;
                    }
                    if (newBox.y + newBox.height > photoSize.height) {
                      constrainedBox.height = photoSize.height - newBox.y;
                    }
                    
                    // Ensure minimum size is maintained
                    if (constrainedBox.width < 50) constrainedBox.width = 50;
                    if (constrainedBox.height < 50) constrainedBox.height = 50;
                    
                    return constrainedBox;
                  }
                  
                  return newBox;
                }}
              />
            )}
          </Layer>
        </Stage>
        
        {/* Hint for users - update to make it clearer */}
        {calendarImage && !isSelected && !isDownloading && (
          <div className="hint">Click on calendar to resize</div>
        )}

        {/* Add additional hint for mobile users */}
        {isMobile && calendarImage && !isSelected && !isDownloading && (
          <div className="calendar-hint">Tap once to resize the calendar</div>
        )}
      </div>
      
      {/* Controls Panel - Make it more compact for mobile */}
      {!isDownloading && (
        <div className="controls-panel">
          {/* Month Navigation */}
          <div className="control-section">
            <label>Month</label>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between' }}>
              <button onClick={() => changeMonth(-1)}>
                {isMobile ? 'Prev' : 'Previous Month'}
              </button>
              <button onClick={() => changeMonth(1)}>
                {isMobile ? 'Next' : 'Next Month'}
              </button>
            </div>
          </div>
          
          {/* Font Options */}
          <div className="control-section">
            <label>Font</label>
            <select 
              value={selectedFont} 
              onChange={handleFontChange}
              className="font-select"
            >
              {AVAILABLE_FONTS.map((font) => (
                <option 
                  key={font.value} 
                  value={font.value}
                  style={{ 
                    fontFamily: font.value,
                    fontSize: '18px',
                    padding: '10px'
                  }}
                >
                  {font.name}
                </option>
              ))}
            </select>
          </div>
          
          {/* Font Color */}
          <div className="control-section">
            <label>Font Color</label>
            {isMobile ? (
              // Mobile color selector
              <div className="color-select-wrapper">
                {isIOSDevice ? (
                  // Special rendering for iOS devices
                  <div className="ios-color-select">
                    {DEFAULT_COLORS.map((color) => (
                      <div 
                        key={color.value}
                        className={`color-option ${selectedColor === color.value ? 'selected' : ''}`}
                        onClick={() => setSelectedColor(color.value)}
                      >
                        <div 
                          className="color-box" 
                          style={{ backgroundColor: color.value }}
                        />
                        <span className="color-name">{color.name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  // Standard dropdown for other mobile devices
                  <select 
                    value={selectedColor} 
                    onChange={handleColorChange}
                    className="color-select"
                    style={{ 
                      backgroundColor: '#ffffff',
                      color: '#333333',
                      border: '2px solid #aaaaaa',
                      fontWeight: 'bold'
                    }}
                  >
                    {DEFAULT_COLORS.map((color) => (
                      <option 
                        key={color.value} 
                        value={color.value}
                      >
                        {color.name}
                      </option>
                    ))}
                  </select>
                )}
                
                {/* Show the currently selected color - improved for visibility */}
                <div className="selected-color">
                  <div 
                    className="color-box" 
                    style={{ 
                      backgroundColor: selectedColor, 
                      border: '1px solid #888',
                      width: '24px',
                      height: '24px'
                    }}
                  ></div>
                  <span style={{ marginLeft: '10px', fontWeight: 'bold' }}>
                    {DEFAULT_COLORS.find(c => c.value === selectedColor)?.name || 'Selected Color'}
                  </span>
                </div>
              </div>
            ) : (
              // Desktop color selector
              <select 
                value={selectedColor} 
                onChange={handleColorChange}
                className="color-select"
              >
                {DEFAULT_COLORS.map((color) => (
                  <option 
                    key={color.value} 
                    value={color.value}
                    style={{ 
                      backgroundColor: color.value, 
                      color: getContrastColor(color.value),
                      padding: '10px'
                    }}
                  >
                    {color.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          
          {/* Photo Filter - made more compact */}
          <div className="control-section">
            <label>Photo Filter</label>
            {isMobile ? (
              <div className="filter-select-wrapper">
                <select 
                  value={selectedFilter} 
                  onChange={handleFilterChange}
                  className="filter-select"
                  style={{ 
                    backgroundColor: '#ffffff',
                    color: '#333333',
                    border: '2px solid #aaaaaa',
                    fontWeight: 'bold'
                  }}
                >
                  {PHOTO_FILTERS.map((filter) => (
                    <option 
                      key={filter.value} 
                      value={filter.value}
                    >
                      {filter.name}
                    </option>
                  ))}
                </select>
                
                {/* Current filter display */}
                <div className="selected-filter">
                  <span style={{ fontWeight: 'bold' }}>
                    {PHOTO_FILTERS.find(f => f.value === selectedFilter)?.name || 'No Filter'}
                  </span>
                </div>
                
                {/* Filter previews - made more compact */}
                <div className="filter-previews">
                  {PHOTO_FILTERS.map((filter) => (
                    <div 
                      key={filter.value} 
                      className={`filter-preview ${selectedFilter === filter.value ? 'active' : ''}`}
                      onClick={() => setSelectedFilter(filter.value)}
                    >
                      <div 
                        className={`filter-thumbnail filter-${filter.value}`}
                        style={{
                          backgroundImage: userImage ? `url(${userImage})` : 'none',
                          ...(filter.value !== 'none' && !isIOSDevice ? filter.style : {})
                        }}
                        data-filter={filter.value}
                      />
                      <span className="filter-name">{filter.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // Desktop filter selector with preview thumbnails
              <div className="desktop-filter-selector">
                <select 
                  value={selectedFilter} 
                  onChange={handleFilterChange}
                  className="filter-select"
                >
                  {PHOTO_FILTERS.map((filter) => (
                    <option 
                      key={filter.value} 
                      value={filter.value}
                    >
                      {filter.name}
                    </option>
                  ))}
                </select>
                
                {/* Filter previews for desktop */}
                <div className="filter-previews">
                  {PHOTO_FILTERS.map((filter) => (
                    <div 
                      key={filter.value} 
                      className={`filter-preview ${selectedFilter === filter.value ? 'active' : ''}`}
                      onClick={() => setSelectedFilter(filter.value)}
                      title={filter.name}
                    >
                      <div 
                        className={`filter-thumbnail filter-${filter.value}`}
                        style={{
                          backgroundImage: userImage ? `url(${userImage})` : 'none',
                          ...(filter.value !== 'none' && !isIOSDevice ? filter.style : {})
                        }}
                        data-filter={filter.value}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Hidden calendar generator */}
      <CalendarGenerator 
        month={calendarMonth} 
        year={calendarYear}
        fontName={selectedFont}
        fontColor={selectedColor}
        onGenerate={handleCalendarGenerated}
      />
    </div>
  );
});

// Helper function to determine contrasting text color for color selector
function getContrastColor(hexColor: string): string {
  // Convert hex to RGB
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return black for light colors, white for dark colors
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

export default PhotoEditor; 