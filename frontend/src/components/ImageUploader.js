import React from 'react';
import { useDropzone } from 'react-dropzone';

const ImageUploader = ({ onImageUpload }) => {
  const { getRootProps, getInputProps } = useDropzone({
    accept: 'image/*',
    multiple: true, // Allow multiple files
    onDrop: acceptedFiles => {
      onImageUpload(acceptedFiles);
    }
  });

  return (
    <div {...getRootProps({ className: 'dropzone' })}>
      <input {...getInputProps()} />
      <p>Drag 'n' drop images here, or click to select multiple</p>
    </div>
  );
};

export default ImageUploader;
