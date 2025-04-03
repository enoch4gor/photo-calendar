import React, { useEffect, useRef } from 'react';

interface CalendarGeneratorProps {
  month: number;
  year: number;
  fontName: string;
  fontColor: string;
  onGenerate: (dataUrl: string) => void;
}

const CalendarGenerator: React.FC<CalendarGeneratorProps> = ({ 
  month, 
  year, 
  fontName = 'Have Idea',
  fontColor = '#ffffff', 
  onGenerate 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Function to load the custom font
    const loadFont = () => {
      return new Promise<void>((resolve) => {
        try {
          // The fonts should already be loaded from index.css
          // Just ensure the font is ready before drawing
          if (document.fonts.check(`12px '${fontName}'`)) {
            resolve();
            return;
          }
          
          // Load as fallback if needed
          const fontPaths = [
            `/fonts/${fontName.replace(/\s+/g, '\\ ')}.ttf`,  // public directory
            `./fonts/${fontName.replace(/\s+/g, '\\ ')}.ttf`  // src directory
          ];
          
          const loadFontFace = async () => {
            for (const path of fontPaths) {
              try {
                const fontFace = new FontFace(fontName, `url(${path})`);
                const loadedFace = await fontFace.load();
                document.fonts.add(loadedFace);
                console.log(`Font loaded successfully from: ${path}`);
                return true;
              } catch (err) {
                console.warn(`Failed to load font from ${path}`, err);
              }
            }
            return false;
          };
          
          loadFontFace()
            .then(() => resolve())
            .catch(() => resolve()); // Continue with fallback font
        } catch (error) {
          console.error('Font loading error:', error);
          resolve(); // Continue with fallback font
        }
      });
    };
    
    // Main rendering function
    const renderCalendar = async () => {
      // Try to load the custom font
      await loadFont();
      
      // Create a much higher resolution canvas for crisper text
      const scaleFactor = 4; // Increased from 2x to 4x
      canvas.width = 1000 * scaleFactor;
      canvas.height = 850 * scaleFactor;
      
      // Create transparent background
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Scale all drawing operations by the scale factor
      ctx.scale(scaleFactor, scaleFactor);
      
      // Note: Some CSS text rendering properties like textRendering, fontKerning,
      // and fontStretch are not available in the Canvas API
      // We'll use other techniques to make text sharp instead
      
      // Disable anti-aliasing for sharper text
      ctx.imageSmoothingEnabled = false;
      
      // Draw month and year header with custom font
      ctx.fillStyle = fontColor;
      // Apply font with slight stroke for sharper edges
      ctx.font = `bold 90px '${fontName}', cursive`;
      ctx.textAlign = 'center';
      
      // Add a slight text shadow effect
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      
      // Draw text with stroke for sharper edges
      const title = `${getMonthName(month)} ${year}`;
      ctx.strokeStyle = fontColor;
      ctx.lineWidth = 1;
      ctx.strokeText(title, 500, 120);
      ctx.fillText(title, 500, 120);
      
      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      
      // Draw days of the week
      ctx.font = `bold 42px '${fontName}', cursive`;
      const cellWidth = 1000 / 7;
      const headerY = 200;
      
      // Day names with different color for weekend
      getDayNames().forEach((day, index) => {
        const x = (index * cellWidth) + (cellWidth / 2);
        
        // Weekends (Sunday and Saturday) in red, other days in the selected color
        if (index === 0 || index === 6) {
          ctx.fillStyle = '#e63946'; // Red for weekends always
          ctx.strokeStyle = '#e63946';
        } else {
          ctx.fillStyle = fontColor; // User selected color for weekdays
          ctx.strokeStyle = fontColor;
        }
        
        // Add a slight text shadow for boldness
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        
        // Draw with stroke for sharper edges
        ctx.lineWidth = 0.5;
        ctx.strokeText(day, x, headerY);
        ctx.fillText(day, x, headerY);
        
        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      });
      
      // Calculate first day of month and number of days
      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      
      // Draw calendar grid
      const startY = 230;
      const cellHeight = 100;
      let currentY = startY;
      
      // Calendar grid
      for (let row = 0; row < 6; row++) {
        currentY = startY + (row * cellHeight);
        
        for (let col = 0; col < 7; col++) {
          const dayNum = row * 7 + col - firstDay + 1;
          const x = col * cellWidth;
          
          // Draw day number if it's within the current month
          if (dayNum > 0 && dayNum <= daysInMonth) {
            // Choose color based on whether it's a weekend
            if (col === 0 || col === 6) {
              ctx.fillStyle = '#e63946'; // Keep red for weekend days
              ctx.strokeStyle = '#e63946';
            } else {
              ctx.fillStyle = fontColor; // User selected color for weekdays
              ctx.strokeStyle = fontColor;
            }
            
            ctx.font = `bold 46px '${fontName}', cursive`;
            ctx.textAlign = 'center';
            
            // Add a slight text shadow for boldness
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 3;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
            
            // Draw day numbers with stroke for sharper edges
            const dayText = dayNum.toString();
            ctx.lineWidth = 0.5;
            ctx.strokeText(dayText, x + cellWidth / 2, currentY + 50);
            ctx.fillText(dayText, x + cellWidth / 2, currentY + 50);
            
            // Reset shadow
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
          }
        }
      }
      
      // Re-enable smoothing for the final output
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Reset scale before creating data URL
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      
      // Convert to data URL with PNG format for better quality
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      onGenerate(dataUrl);
    };
    
    renderCalendar();
    
  }, [month, year, fontName, fontColor, onGenerate]);
  
  return (
    <canvas 
      ref={canvasRef} 
      style={{ display: 'none' }} // Hide canvas as we only need the generated image
      width="1000"
      height="850"
    />
  );
};

// Helper functions
function getMonthName(monthIndex: number): string {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return monthNames[monthIndex];
}

function getDayNames(): string[] {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
}

export default CalendarGenerator; 