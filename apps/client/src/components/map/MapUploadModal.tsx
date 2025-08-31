/**
 * Map Upload Modal - Handle map image uploads with metadata
 */
import React, { useState, useRef } from 'react';
import { logger } from '@vtt/logging';
import { 
  Upload, 
  X, 
  Image, 
  FileImage, 
  Grid3X3,
  Ruler,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { cn } from '../../lib/utils';
import AccessibleModal from '../AccessibleModal';

interface MapUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: (_map: any) => void;
  campaignId?: string;
}

interface UploadState {
  file: File | null;
  preview: string | null;
  uploading: boolean;
  error: string | null;
  progress: number;
}

interface MapMetadata {
  name: string;
  description: string;
  gridSize: number;
  gridUnits: string;
  realWorldScale: number; // pixels per unit
}

export function MapUploadModal({ isOpen, onClose, onUploadComplete, campaignId }: MapUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<UploadState>({
    file: null,
    preview: null,
    uploading: false,
    error: null,
    progress: 0
  });
  
  const [metadata, setMetadata] = useState<MapMetadata>({
    name: '',
    description: '',
    gridSize: 70,
    gridUnits: 'feet',
    realWorldScale: 70 // 70 pixels = 5 feet (default D&D scale)
  });

  const [dragOver, setDragOver] = useState(false);

  if (!isOpen) return null;

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setUploadState(prev => ({ ...prev, error: 'Please select a valid image file' }));
      return;
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      setUploadState(prev => ({ ...prev, error: 'File size must be less than 50MB' }));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = e.target?.result as string;
      setUploadState(prev => ({
        ...prev,
        file,
        preview,
        error: null
      }));
      
      // Auto-generate name from filename if not set
      if (!metadata.name) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        setMetadata(prev => ({ ...prev, name: nameWithoutExt }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleUpload = async () => {
    if (!uploadState.file) return;

    setUploadState(prev => ({ ...prev, uploading: true, error: null, progress: 0 }));

    try {
      const formData = new FormData();
      formData.append('map', uploadState.file);
      formData.append('metadata', JSON.stringify({
        ...metadata,
        campaignId
      }));

      const response = await fetch('/api/maps/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      
      setUploadState(prev => ({ ...prev, uploading: false, progress: 100 }));
      
      // Call success callback
      onUploadComplete(result.map);
      
      // Reset and close
      setTimeout(() => {
        handleClose();
      }, 1000);

    } catch (error) {
      logger.error('Upload error:', error);
      setUploadState(prev => ({
        ...prev,
        uploading: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      }));
    }
  };

  const handleClose = () => {
    setUploadState({
      file: null,
      preview: null,
      uploading: false,
      error: null,
      progress: 0
    });
    setMetadata({
      name: '',
      description: '',
      gridSize: 70,
      gridUnits: 'feet',
      realWorldScale: 70
    });
    onClose();
  };

  const canUpload = uploadState.file && metadata.name.trim() && !uploadState.uploading;

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Upload Map"
      size="xl"
      className="max-h-[90vh] overflow-y-auto"
    >
      <Card className="w-full border-0 shadow-none">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Map
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* File Upload Area */}
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
              dragOver ? "border-primary-500 bg-primary-50" : "border-neutral-300",
              uploadState.file ? "border-success-300 bg-success-50" : ""
            )}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {uploadState.preview ? (
              <div className="space-y-4">
                <img 
                  src={uploadState.preview} 
                  alt="Map preview" 
                  className="max-h-48 mx-auto rounded-lg shadow-md"
                />
                <div className="flex items-center justify-center gap-2 text-success-700">
                  <CheckCircle className="h-4 w-4" />
                  <span className="font-medium">{uploadState.file?.name}</span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose Different File
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="mx-auto w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center">
                  <FileImage className="h-8 w-8 text-neutral-500" />
                </div>
                <div>
                  <p className="text-lg font-medium text-neutral-900">
                    Drop your map image here
                  </p>
                  <p className="text-neutral-600 mt-1">
                    or click to browse files
                  </p>
                </div>
                <Button 
                  variant="primary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose File
                </Button>
                <p className="text-xs text-neutral-500">
                  Supports: JPG, PNG, WEBP, GIF (max 50MB)
                </p>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
          />

          {/* Error Display */}
          {uploadState.error && (
            <div className="flex items-center gap-2 p-3 bg-error-50 border border-error-200 rounded-lg text-error-800">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{uploadState.error}</span>
            </div>
          )}

          {/* Map Metadata */}
          <div className="space-y-4">
            <h4 className="font-medium text-neutral-900">Map Details</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Map Name *
                </label>
                <Input
                  value={metadata.name}
                  onChange={(e) => setMetadata(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter map name"
                  disabled={uploadState.uploading}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Grid Size (pixels)
                </label>
                <Input
                  type="number"
                  value={metadata.gridSize}
                  onChange={(e) => setMetadata(prev => ({ ...prev, gridSize: parseInt(e.target.value) || 70 }))}
                  min="20"
                  max="200"
                  disabled={uploadState.uploading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Description
              </label>
              <textarea
                value={metadata.description}
                onChange={(e) => setMetadata(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description for this map"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                rows={3}
                disabled={uploadState.uploading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Grid Units
                </label>
                <select
                  value={metadata.gridUnits}
                  onChange={(e) => setMetadata(prev => ({ ...prev, gridUnits: e.target.value }))}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  disabled={uploadState.uploading}
                >
                  <option value="feet">Feet</option>
                  <option value="meters">Meters</option>
                  <option value="squares">Squares</option>
                  <option value="hexes">Hexes</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Real World Scale
                </label>
                <Input
                  type="number"
                  value={metadata.realWorldScale}
                  onChange={(e) => setMetadata(prev => ({ ...prev, realWorldScale: parseInt(e.target.value) || 70 }))}
                  placeholder="Pixels per unit"
                  disabled={uploadState.uploading}
                />
              </div>
            </div>
          </div>

          {/* Upload Progress */}
          {uploadState.uploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Uploading...</span>
                <span>{uploadState.progress}%</span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-2">
                <div 
                  className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadState.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={handleClose} disabled={uploadState.uploading}>
              Cancel
            </Button>
            <Button 
              variant="primary" 
              onClick={handleUpload}
              disabled={!canUpload}
            >
              {uploadState.uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Map
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </AccessibleModal>
  );
}
