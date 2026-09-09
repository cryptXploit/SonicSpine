import { CameraView } from './components/CameraView/CameraView';

function App() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 p-4">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-slate-800 mb-2">SonicSpine</h1>
        <p className="text-slate-600">Camera-based posture intelligence</p>
      </header>

      <main className="w-full max-w-4xl bg-white shadow-xl rounded-xl p-6">
        <div className="w-full aspect-video rounded-lg overflow-hidden bg-slate-900 shadow-inner border border-slate-200">
          <CameraView 
            onStreamReady={() => {
              console.log("Camera stream ready");
            }} 
          />
        </div>
      </main>

      <footer className="mt-8 text-slate-500 text-sm">
        <p>Local processing only. No video is uploaded.</p>
      </footer>
    </div>
  );
}

export default App;
