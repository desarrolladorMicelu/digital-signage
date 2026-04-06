import { useState, useEffect, useRef } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

export default function MediaPage() {
  const [media, setMedia] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => { loadMedia(); }, []);

  async function loadMedia() {
    try {
      const { data } = await api.get('/media');
      setMedia(data);
    } catch { toast.error('Error cargando media'); }
  }

  async function uploadFiles(files) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((f) => formData.append('files', f));
      await api.post('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(`${files.length} archivo(s) subido(s)`);
      loadMedia();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error subiendo archivos');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este archivo?')) return;
    try {
      await api.delete(`/media/${id}`);
      toast.success('Archivo eliminado');
      loadMedia();
    } catch { toast.error('Error eliminando archivo'); }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragActive(false);
    uploadFiles(e.dataTransfer.files);
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Media</h2>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all mb-6 ${
          dragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
        }`}
      >
        <input
          ref={fileInputRef} type="file" multiple accept="image/*,video/*"
          onChange={(e) => uploadFiles(e.target.files)}
          className="hidden"
        />
        {uploading ? (
          <div>
            <p className="text-lg mb-1">Subiendo...</p>
            <div className="w-32 h-1 bg-gray-200 rounded-full mx-auto overflow-hidden">
              <div className="h-full bg-indigo-600 rounded-full animate-pulse w-full" />
            </div>
          </div>
        ) : (
          <div>
            <p className="text-gray-600 font-medium">Arrastra archivos aquí o haz clic para seleccionar</p>
            <p className="text-sm text-gray-400 mt-1">JPG, PNG, GIF, WEBP, MP4 (max 50MB)</p>
          </div>
        )}
      </div>

      {media.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-gray-100">
          <p className="text-gray-500">No hay archivos subidos</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {media.map((item) => (
            <div key={item.id} className="group bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
              <div className="aspect-video bg-gray-100 relative overflow-hidden">
                {item.mime_type?.startsWith('video/') ? (
                  <div className="w-full h-full flex items-center justify-center bg-gray-800 text-white text-sm px-2 text-center">
                    Video
                  </div>
                ) : (
                  <img src={item.url} alt={item.original_name} className="w-full h-full object-cover" loading="lazy" />
                )}
                <button
                  onClick={() => handleDelete(item.id)}
                  className="absolute top-2 right-2 bg-red-500 text-white w-7 h-7 rounded-full text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 flex items-center justify-center"
                >
                  Eliminar
                </button>
              </div>
              <div className="p-2.5">
                <p className="text-xs font-medium text-gray-700 truncate" title={item.original_name}>
                  {item.original_name}
                </p>
                <p className="text-xs text-gray-400">{formatSize(item.size)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
