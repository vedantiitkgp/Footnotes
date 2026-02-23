import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import './DropZone.css';

export default function DropZone({ files, onFilesChange }) {
  const onDrop = useCallback(
    (accepted) => {
      onFilesChange((prev) => {
        const existing = new Set(prev.map((f) => f.name + f.size));
        const fresh = accepted.filter((f) => !existing.has(f.name + f.size));
        return [...prev, ...fresh].slice(0, 20);
      });
    },
    [onFilesChange]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: true,
    maxFiles: 20,
  });

  return (
    <div
      {...getRootProps()}
      className={`dropzone ${isDragActive ? 'dropzone--active' : ''} ${files.length > 0 ? 'dropzone--has-files' : ''}`}
    >
      <input {...getInputProps()} />
      <div className="dropzone__inner">
        <div className="dropzone__icon">
          {isDragActive ? '✦' : '⊕'}
        </div>
        <p className="dropzone__title">
          {isDragActive
            ? 'Release to add photos'
            : files.length > 0
            ? `${files.length} photo${files.length !== 1 ? 's' : ''} selected`
            : 'Drop your travel photos here'}
        </p>
        <p className="dropzone__hint">
          {files.length > 0
            ? 'Drop more to add · Click to browse'
            : 'or click to browse · up to 20 images'}
        </p>
      </div>
    </div>
  );
}
