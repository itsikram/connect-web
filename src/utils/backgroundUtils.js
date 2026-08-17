/**
 * Calculate the average brightness of an image
 * @param {string} imageUrl - URL of the image
 * @returns {Promise<number>} - Brightness value (0-255)
 */
export const getImageBrightness = async (imageUrl) => {
    return new Promise((resolve) => {
        try {
            if (!imageUrl) {
                resolve(128); // Default to medium brightness
                return;
            }

            const img = new Image();
            img.crossOrigin = 'Anonymous';

            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Limit canvas size for performance (sample only a small portion)
                    const maxSize = 100;
                    const width = Math.min(img.width, maxSize);
                    const height = Math.min(img.height, maxSize);
                    
                    canvas.width = width;
                    canvas.height = height;
                    
                    ctx.drawImage(img, 0, 0, width, height);
                    const imageData = ctx.getImageData(0, 0, width, height);
                    const data = imageData.data;
                    
                    let totalBrightness = 0;
                    const pixelCount = data.length / 4;
                    
                    // Calculate average brightness using relative luminance formula
                    for (let i = 0; i < data.length; i += 4) {
                        const r = data[i];
                        const g = data[i + 1];
                        const b = data[i + 2];
                        // Standard luminance calculation
                        const brightness = (0.299 * r + 0.587 * g + 0.114 * b);
                        totalBrightness += brightness;
                    }
                    
                    const averageBrightness = totalBrightness / pixelCount;
                    resolve(averageBrightness);
                } catch (error) {
                    console.warn('Error calculating brightness:', error);
                    resolve(128);
                }
            };

            img.onerror = () => {
                console.warn('Failed to load image for brightness detection:', imageUrl);
                resolve(128); // Default to medium brightness on error
            };

            img.src = imageUrl;
        } catch (error) {
            console.warn('Error in getImageBrightness:', error);
            resolve(128); // Default to medium brightness on error
        }
    });
};

/**
 * Determine if a background image is dark
 * Threshold: brightness < 140 is considered dark
 * @param {string} imageUrl - URL of the image
 * @returns {Promise<boolean>} - True if image is dark
 */
export const isBackgroundDark = async (imageUrl) => {
    const brightness = await getImageBrightness(imageUrl);
    return brightness < 140; // Adjust threshold if needed (0-255)
};
