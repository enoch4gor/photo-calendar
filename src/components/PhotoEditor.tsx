import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
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
  const [selectedFont, setSelectedFont] = useState(AVAILABLE_FONTS[0].value);
  const [selectedColor, setSelectedColor] = useState(DEFAULT_COLORS[0].value);
  
  // Photo filter state
  const [selectedFilter, setSelectedFilter] = useState(PHOTO_FILTERS[0].value);
  
  // Add a state to track mobile view
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  // Add iOS detection
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  
  // Add the filtered image state
  const [filteredImage, setFilteredImage] = useState<string | null>(null);
  
  // Check if it's an iOS device on mount
  useEffect(() => {
    setIsIOSDevice(isIOS());
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
            // Get the data URL of the stage with the filtered image
            const dataUrl = stageRef.current.toDataURL({
              pixelRatio: 3, // Use high resolution
              mimeType: 'image/png',
              quality: 1
            });
            
            // Restore selection state if needed
            if (wasSelected) {
              setIsSelected(true);
            }
            
            resolve(dataUrl);
          } catch (error) {
            console.error('Error generating image:', error);
            // Restore selection state if needed
            if (wasSelected) {
              setIsSelected(true);
            }
            reject(error);
          }
        }, 50);
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

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw the original image
      ctx.drawImage(img, 0, 0);

      // Get filter style
      const filterStyle = filter.style.filter || '';
      
      // Apply the filter to the image
      if (filterStyle) {
        // Apply filter using CSS filter
        const tempImg = new Image();
        tempImg.onload = () => {
          // Reset canvas with filtered image
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Apply filter
          ctx.filter = filterStyle;
          ctx.drawImage(tempImg, 0, 0);
          ctx.filter = 'none';
          
          // Get the filtered image data URL
          setFilteredImage(canvas.toDataURL('image/png'));
        };
        tempImg.src = canvas.toDataURL('image/png');
      }
    };
    img.src = userImage;
    
  }, [userImage, selectedFilter]);

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

  return (
    <div className="editor-layout">
      <div className="canvas-container">
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
                        className="filter-thumbnail" 
                        style={{
                          backgroundImage: userImage ? `url(${userImage})` : 'none',
                          ...filter.style
                        }}
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
                        className="filter-thumbnail" 
                        style={{
                          backgroundImage: userImage ? `url(${userImage})` : 'none',
                          ...filter.style
                        }}
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