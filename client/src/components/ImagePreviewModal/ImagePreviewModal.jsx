/**
 * ImagePreviewModal.jsx — Xem trước hóa đơn (Zoom, Xoay, Fullscreen)
 */

import { useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, Maximize2, Minimize2, RefreshCw } from 'lucide-react';
import './ImagePreviewModal.css';

export default function ImagePreviewModal({ src, alt = 'Hóa đơn', onClose }) {
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const handleZoomIn = () => setZoom(z => Math.min(z + 0.25, 4));
    const handleZoomOut = () => setZoom(z => Math.max(z - 0.25, 0.25));
    const handleRotate = () => setRotation(r => (r + 90) % 360);
    const handleReset = () => { setZoom(1); setRotation(0); };
    const toggleFullscreen = () => setIsFullscreen(f => !f);

    // Scroll to zoom
    const handleWheel = (e) => {
        e.preventDefault();
        if (e.deltaY < 0) handleZoomIn();
        else handleZoomOut();
    };

    if (!src) return null;

    return (
        <div className="img-preview-overlay" onClick={onClose}>
            <div
                className={`img-preview-container ${isFullscreen ? 'img-preview-fullscreen' : ''}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Toolbar */}
                <div className="img-preview-toolbar">
                    <div className="img-preview-toolbar__left">
                        <span className="img-preview-toolbar__title">Xem hóa đơn</span>
                        <span className="img-preview-toolbar__zoom">{Math.round(zoom * 100)}%</span>
                    </div>
                    <div className="img-preview-toolbar__actions">
                        <button onClick={handleZoomOut} title="Thu nhỏ"><ZoomOut size={18} /></button>
                        <button onClick={handleZoomIn} title="Phóng to"><ZoomIn size={18} /></button>
                        <button onClick={handleRotate} title="Xoay 90°"><RotateCw size={18} /></button>
                        <button onClick={handleReset} title="Đặt lại"><RefreshCw size={16} /></button>
                        <button onClick={toggleFullscreen} title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}>
                            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                        </button>
                        <button onClick={onClose} title="Đóng" className="img-preview-close"><X size={20} /></button>
                    </div>
                </div>

                {/* Image area */}
                <div className="img-preview-viewport" onWheel={handleWheel}>
                    <img
                        src={src}
                        alt={alt}
                        crossOrigin="anonymous"
                        className="img-preview-image"
                        style={{
                            transform: `scale(${zoom}) rotate(${rotation}deg)`,
                        }}
                        draggable={false}
                    />
                </div>
            </div>
        </div>
    );
}
