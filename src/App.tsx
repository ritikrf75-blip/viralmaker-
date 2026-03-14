import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Download, Loader2, Image as ImageIcon, Type, Share2, AlertCircle, Settings, Layers, ChevronRight } from 'lucide-react';
import { generateBulkPostContent, generatePostImage, PostContent } from './lib/gemini';
import { motion, AnimatePresence } from 'motion/react';

interface GeneratedPost {
  content: PostContent;
  imageUrl: string;
  canvasDataUrl: string | null;
}

export default function App() {
  const [story, setStory] = useState('');
  const [numPosts, setNumPosts] = useState(3);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [generatedPosts, setGeneratedPosts] = useState<GeneratedPost[]>([]);
  const [progress, setProgress] = useState(0);
  
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  const handleGenerate = async () => {
    if (!story.trim()) return;
    
    setLoading(true);
    setError(null);
    setGeneratedPosts([]);
    setProgress(0);
    
    try {
      setStatus('🧠 AI is brainstorming viral concepts...');
      const contents = await generateBulkPostContent(story, numPosts);
      
      const posts: GeneratedPost[] = [];
      for (let i = 0; i < contents.length; i++) {
        const content = contents[i];
        setStatus(`🎨 Generating Image ${i + 1} of ${contents.length}...`);
        try {
          const imageUrl = await generatePostImage(content.image_prompt);
          posts.push({ content, imageUrl, canvasDataUrl: null });
          setGeneratedPosts([...posts]); // Update UI incrementally
          setProgress(((i + 1) / contents.length) * 100);
        } catch (imgErr) {
          console.error(`Failed to generate image for post ${i + 1}`, imgErr);
        }
      }
      
      setStatus('✨ Finalizing all masterpieces...');
    } catch (err) {
      console.error(err);
      setError('Bhai, kuch gadbad ho gayi. AI ne data theek se nahi diya ya API limit hit ho gayi.');
    } finally {
      setLoading(false);
      setStatus('');
    }
  };

  const wrapText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
    const words = text.split(' ');
    let line = '';
    let currentY = y;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, currentY);
  };

  const drawCanvas = (index: number) => {
    const canvas = canvasRefs.current[index];
    const post = generatedPosts[index];
    if (!canvas || !post || !post.imageUrl) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 1080;
    const height = 1350;
    canvas.width = width;
    canvas.height = height;

    // 1. Top Yellow Box (200px)
    ctx.fillStyle = '#FFFF00';
    ctx.fillRect(0, 0, width, 200);

    // 2. Draw Top Text
    ctx.fillStyle = 'black';
    ctx.font = 'bold 55px "Inter", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    wrapText(ctx, post.content.top_text, 40, 40, width - 80, 65);

    // 3. Middle AI Image (850px)
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const targetW = 1080;
      const targetH = 850;
      const targetY = 200;

      const imgRatio = img.width / img.height;
      const targetRatio = targetW / targetH;

      let sourceX, sourceY, sourceW, sourceH;

      if (imgRatio > targetRatio) {
        sourceH = img.height;
        sourceW = img.height * targetRatio;
        sourceX = (img.width - sourceW) / 2;
        sourceY = 0;
      } else {
        sourceW = img.width;
        sourceH = img.width / targetRatio;
        sourceX = 0;
        sourceY = (img.height - sourceH) / 2;
      }

      ctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, targetY, targetW, targetH);

      // 4. Bottom Black Box (300px)
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 1050, width, 300);

      // 5. Draw Bottom Text
      ctx.fillStyle = 'white';
      ctx.font = 'bold 45px "Inter", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      wrapText(ctx, post.content.bottom_text, 40, 1100, width - 80, 55);
      
      // Update data URL for download using functional state update to avoid race conditions
      setGeneratedPosts(prev => {
        const next = [...prev];
        if (next[index]) {
          next[index] = { ...next[index], canvasDataUrl: canvas.toDataURL('image/png') };
        }
        return next;
      });
    };
    img.src = post.imageUrl;
  };

  useEffect(() => {
    // Only trigger drawing for posts that have an image but haven't been processed into a data URL yet
    generatedPosts.forEach((post, idx) => {
      if (post.imageUrl && !post.canvasDataUrl) {
        drawCanvas(idx);
      }
    });
  }, [generatedPosts.map(p => p.imageUrl).join(',')]); // Dependency on the image URLs specifically

  const downloadImage = (index: number) => {
    const canvas = canvasRefs.current[index];
    if (!canvas) return;
    
    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          alert('Bhai, image generate nahi ho payi. Ek baar phir try karo.');
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `viral_post_${index + 1}.png`;
        
        // Append to body to ensure it works in all browsers
        document.body.appendChild(link);
        link.click();
        
        // Cleanup
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 100);
      }, 'image/png');
    } catch (err) {
      console.error('Download failed:', err);
      // Fallback for tainted canvas or other issues
      const dataUrl = canvas.toDataURL('image/png');
      const win = window.open();
      if (win) {
        win.document.write(`<img src="${dataUrl}" style="max-width:100%;" />`);
        win.document.write('<p>Right-click or Long-press to save image</p>');
      } else {
        alert('Download blocked. Please right-click the image and select "Save Image As".');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-[#1a1a1a] font-sans selection:bg-yellow-200 flex">
      {/* Sidebar */}
      <aside className="w-80 bg-white border-r border-black/5 hidden lg:flex flex-col sticky top-0 h-screen">
        <div className="p-6 border-b border-black/5">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center shadow-lg shadow-yellow-400/20">
              <Sparkles className="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">ViralMaker</h1>
              <p className="text-[10px] uppercase tracking-widest font-bold opacity-30">Bulk AI Edition</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-8 flex-1 overflow-y-auto">
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest opacity-40">
              <Settings className="w-3 h-3" />
              <span>Generation Settings</span>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-bold">
                  <span>Number of Posts</span>
                  <span className="text-yellow-600">{numPosts}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={numPosts}
                  onChange={(e) => setNumPosts(parseInt(e.target.value))}
                  className="w-full h-2 bg-black/5 rounded-lg appearance-none cursor-pointer accent-yellow-400"
                />
                <div className="flex justify-between text-[10px] opacity-30 font-bold">
                  <span>1 Post</span>
                  <span>10 Posts</span>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest opacity-40">
              <Layers className="w-3 h-3" />
              <span>Format Details</span>
            </div>
            <div className="bg-[#f8f9fa] rounded-xl p-4 space-y-3">
              <div className="flex justify-between text-xs">
                <span className="opacity-50">Ratio</span>
                <span className="font-bold">4:5 (Portrait)</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="opacity-50">Resolution</span>
                <span className="font-bold">1080x1350 px</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="opacity-50">Font</span>
                <span className="font-bold">Inter Bold</span>
              </div>
            </div>
          </section>
        </div>

        <div className="p-6 border-t border-black/5">
          <p className="text-[10px] text-center opacity-30 font-bold uppercase tracking-widest">
            Powered by Gemini 3.1
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-black/5 flex items-center px-8 sticky top-0 z-10 lg:hidden">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-500" />
            <h1 className="font-bold">ViralMaker Bulk</h1>
          </div>
        </header>

        <div className="p-8 lg:p-12 max-w-6xl mx-auto w-full space-y-12">
          {/* Input Section */}
          <section className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-3xl font-black tracking-tight">Bulk 10x Generator</h2>
              <p className="text-black/40 font-medium">Daalo apni lambi story ya multiple facts, AI sabke liye alag posts bana dega.</p>
            </div>

            <div className="bg-white rounded-3xl shadow-xl shadow-black/5 border border-black/5 p-8 space-y-6">
              <textarea
                value={story}
                onChange={(e) => setStory(e.target.value)}
                placeholder="Example: 1. Ek 9 saal ka baccha 2 saal akela raha... 2. Samandar ke andar ek aisi machli hai jo..."
                className="w-full h-40 bg-transparent border-none focus:ring-0 resize-none text-xl placeholder:text-black/10 font-medium"
              />
              
              <div className="flex flex-col md:flex-row gap-4 items-center">
                <button
                  onClick={handleGenerate}
                  disabled={loading || !story.trim()}
                  className={`flex-1 h-16 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all active:scale-95 ${
                    loading || !story.trim()
                      ? 'bg-black/5 text-black/20 cursor-not-allowed'
                      : 'bg-yellow-400 text-black hover:bg-yellow-300 shadow-xl shadow-yellow-400/30'
                  }`}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>{status}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-6 h-6" />
                      <span>10x Magic Shuru Karo</span>
                    </>
                  )}
                </button>
                
                <div className="lg:hidden flex items-center gap-4 bg-black/5 px-6 h-16 rounded-2xl">
                  <span className="text-xs font-bold uppercase tracking-widest opacity-40">Posts:</span>
                  <select 
                    value={numPosts} 
                    onChange={(e) => setNumPosts(parseInt(e.target.value))}
                    className="bg-transparent border-none font-bold focus:ring-0"
                  >
                    {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>

              {loading && (
                <div className="space-y-2">
                  <div className="h-2 w-full bg-black/5 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-yellow-400"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-30 text-center">
                    Generating {Math.round(progress)}%
                  </p>
                </div>
              )}
            </div>
          </section>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="p-6 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-4 text-red-600"
              >
                <AlertCircle className="w-6 h-6 shrink-0" />
                <p className="font-bold">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results Grid */}
          {generatedPosts.length > 0 && (
            <section className="space-y-8">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black tracking-tight flex items-center gap-2">
                  <Layers className="w-5 h-5 text-yellow-500" />
                  Generated Masterpieces ({generatedPosts.length})
                </h3>
                {generatedPosts.every(p => p.canvasDataUrl) && (
                  <p className="text-xs font-bold text-green-600 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    All Ready!
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {generatedPosts.map((post, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="space-y-4 group"
                  >
                    <div className="relative aspect-[4/5] bg-white rounded-[2rem] shadow-2xl border border-black/5 overflow-hidden">
                      <canvas
                        ref={el => canvasRefs.current[idx] = el}
                        className="w-full h-full object-contain"
                      />
                      {/* Transparent overlay image for native long-press saving */}
                      {post.canvasDataUrl && (
                        <img 
                          src={post.canvasDataUrl} 
                          alt="Generated Post"
                          className="absolute inset-0 w-full h-full object-contain opacity-0 z-10 cursor-pointer"
                          onContextMenu={(e) => e.stopPropagation()}
                        />
                      )}
                      {!post.canvasDataUrl && (
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                          <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => downloadImage(idx)}
                        disabled={!post.canvasDataUrl}
                        className="flex-1 h-12 bg-black text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-black/80 transition-all disabled:opacity-20"
                      >
                        <Download className="w-4 h-4" />
                        Download #{idx + 1}
                      </button>
                      <button
                        onClick={() => {
                          if (navigator.share && post.canvasDataUrl) {
                            fetch(post.canvasDataUrl).then(res => res.blob()).then(blob => {
                              const file = new File([blob], `post_${idx+1}.png`, { type: 'image/png' });
                              navigator.share({ files: [file], title: 'AI Viral Post' });
                            });
                          }
                        }}
                        className="w-12 h-12 border-2 border-black rounded-xl flex items-center justify-center hover:bg-black/5 transition-all"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          )}
        </div>

        <footer className="mt-auto p-12 border-t border-black/5 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-20">
            Instagram Standard 1080x1350 • 4:5 Aspect Ratio
          </p>
        </footer>
      </main>
    </div>
  );
}
