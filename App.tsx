
import React, { useState, useRef, useEffect } from 'react';
import { THEMES, VOICES, SCRIPT_THEMES, SPEECH_STYLES, EMOTIONS, LANGUAGES, TRANSLATIONS } from './constants';
import { AudioState, Language } from './types';
import { generateVoice, generateScript, generateTitleSuggestion, generateImage, generateBombasticTitle, generateThumbnailText, generateDescription, generateTags } from './services/geminiService';

const App: React.FC = () => {
  const [activeTheme, setActiveTheme] = useState(THEMES[0]);
  const [language, setLanguage] = useState<string>('id');
  const [selectedVoice, setSelectedVoice] = useState(VOICES[0]);
  const [projectTitle, setProjectTitle] = useState("");
  const [bombasticTitle, setBombasticTitle] = useState("");
  const [thumbnailText, setThumbnailText] = useState("");
  const [videoDescription, setVideoDescription] = useState("");
  const [videoTags, setVideoTags] = useState("");
  const [scriptTheme, setScriptTheme] = useState(SCRIPT_THEMES[0].id);
  const [inputText, setInputText] = useState("");
  const [emotion, setEmotion] = useState("normally");
  const [speechStyle, setSpeechStyle] = useState("default");
  const [paragraphCount, setParagraphCount] = useState(2);
  const [imageCount, setImageCount] = useState(1);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingBombastic, setIsGeneratingBombastic] = useState(false);
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);
  const [isGeneratingSEO, setIsGeneratingSEO] = useState(false);
  const [suggestedTitles, setSuggestedTitles] = useState<string[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [audioState, setAudioState] = useState<AudioState>({
    isPlaying: false,
    isLoading: false,
    error: null,
  });

  const t = TRANSLATIONS[language] || TRANSLATIONS['en'];

  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const maleVoices = VOICES.filter(v => v.gender === 'Male');
  const femaleVoices = VOICES.filter(v => v.gender === 'Female');

  const getThemeLabel = (themeId: string) => {
    const theme = SCRIPT_THEMES.find(st => st.id === themeId);
    return theme ? t[theme.labelKey] : themeId;
  };

  const handleSuggestTitle = async () => {
    setIsGeneratingTitle(true);
    setAudioState(prev => ({ ...prev, error: null }));
    try {
      const suggested = await generateTitleSuggestion(getThemeLabel(scriptTheme), language as Language);
      setSuggestedTitles(suggested);
    } catch (err: any) {
      setAudioState(prev => ({ ...prev, error: "Gagal memuat saran judul." }));
    } finally {
      setIsGeneratingTitle(false);
    }
  };

  const handleSelectTitle = (title: string) => {
    setProjectTitle(title);
    setSuggestedTitles([]);
  };

  const handleGenerateBombastic = async () => {
    if (!projectTitle.trim()) {
      setAudioState(prev => ({ ...prev, error: "Tulis judul topik dulu!" }));
      return;
    }
    setIsGeneratingBombastic(true);
    setAudioState(prev => ({ ...prev, error: null }));
    try {
      const title = await generateBombasticTitle(projectTitle, getThemeLabel(scriptTheme), language as Language);
      setBombasticTitle(title);
      handleGenerateThumbnail(title);
      handleGenerateSEO(title);
    } catch (err: any) {
      setAudioState(prev => ({ ...prev, error: "Gagal meracik judul viral." }));
    } finally {
      setIsGeneratingBombastic(false);
    }
  };

  const handleGenerateThumbnail = async (refTitle?: string) => {
    setIsGeneratingThumbnail(true);
    try {
      const text = await generateThumbnailText(projectTitle, refTitle || bombasticTitle, language as Language);
      setThumbnailText(text);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingThumbnail(false);
    }
  };

  const handleGenerateSEO = async (refTitle?: string) => {
    setIsGeneratingSEO(true);
    try {
      const currentTitle = refTitle || bombasticTitle || projectTitle;
      const [desc, tags] = await Promise.all([
        generateDescription(projectTitle, currentTitle, language as Language),
        generateTags(projectTitle, currentTitle, language as Language)
      ]);
      setVideoDescription(desc);
      setVideoTags(tags);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingSEO(false);
    }
  };

  const handleGenerateScript = async () => {
    if (!projectTitle.trim()) {
      setAudioState(prev => ({ ...prev, error: "Tulis judul topik dulu!" }));
      return;
    }
    setIsGeneratingScript(true);
    setAudioState(prev => ({ ...prev, error: null }));
    try {
      const script = await generateScript(projectTitle, getThemeLabel(scriptTheme), paragraphCount, language as Language);
      setInputText(prev => prev ? prev + "\n\n" + script : script);
    } catch (err: any) {
      setAudioState(prev => ({ ...prev, error: "Gagal membuat naskah." }));
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const handleGenerateVisual = async () => {
    if (!projectTitle.trim()) {
      setAudioState(prev => ({ ...prev, error: "Tulis judul topik dulu!" }));
      return;
    }
    setIsGeneratingImage(true);
    setAudioState(prev => ({ ...prev, error: null }));
    try {
      const images = await generateImage(projectTitle, getThemeLabel(scriptTheme), emotion, imageCount);
      setImageUrls(prev => [...prev, ...images]);
    } catch (err: any) {
      setAudioState(prev => ({ ...prev, error: err.message || "Gagal membuat visual." }));
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleGenerateFull = async () => {
    if (!inputText.trim()) {
      setAudioState(prev => ({ ...prev, error: "Isi naskah dulu!" }));
      return;
    };
    
    if (audioSourceRef.current) audioSourceRef.current.stop();
    setAudioState({ isPlaying: false, isLoading: true, error: null });
    
    try {
      const voiceRes = await generateVoice(inputText, selectedVoice.id, language as Language, emotion, speechStyle);
      const { buffer, context, blob } = voiceRes;
      audioContextRef.current = context;
      const newUrl = URL.createObjectURL(blob);
      setAudioUrl(newUrl);
      
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.onended = () => setAudioState(prev => ({ ...prev, isPlaying: false }));
      source.start();
      audioSourceRef.current = source;
      setAudioState({ isPlaying: true, isLoading: false, error: null });
    } catch (err: any) {
      setAudioState({ isPlaying: false, isLoading: false, error: err.message || "Gagal menghasilkan studio." });
    }
  };

  const playPreview = () => {
    if (audioState.isPlaying) {
      if (audioSourceRef.current) audioSourceRef.current.stop();
      setAudioState(prev => ({ ...prev, isPlaying: false }));
    } else {
      handleGenerateFull();
    }
  };

  return (
    <div className={`min-h-screen transition-all duration-700 p-4 md:p-8 ${activeTheme.bgClass} flex flex-col items-center ${activeTheme.textClass}`}>
      <header className="w-full max-w-6xl flex flex-col md:flex-row justify-between items-center mb-8 gap-6">
        <div className="flex items-center gap-3">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-lg ${activeTheme.accentClass}`}>🚀</div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight uppercase">{t.appName}</h1>
            <p className="text-xs opacity-50 uppercase tracking-widest font-medium">{t.appSub}</p>
            <p className="text-sm opacity-70 font-semibold tracking-tight mt-0.5">By. Syarif Hidayatullah</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          {THEMES.map((theme) => (
            <button
              key={theme.id} onClick={() => setActiveTheme(theme)}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${activeTheme.id === theme.id ? 'ring-2 ring-offset-2 ring-blue-500 scale-110 shadow-lg' : 'opacity-40 scale-90'} ${theme.bgClass} border border-slate-200`}
            >
              <span className="text-xl">{theme.icon}</span>
            </button>
          ))}
        </div>
      </header>

      {audioState.error && (
        <div className="w-full max-w-6xl mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-bold animate-bounce flex justify-between items-center">
          <span>⚠️ {audioState.error}</span>
          <button onClick={() => setAudioState(prev => ({ ...prev, error: null }))} className="text-[10px] uppercase tracking-widest">Tutup</button>
        </div>
      )}

      <main className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8">
        <aside className={`lg:col-span-4 flex flex-col gap-6 p-6 rounded-3xl border h-fit ${activeTheme.cardClass}`}>
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider mb-3 opacity-70 flex items-center gap-2">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${activeTheme.isDark ? 'bg-white/10' : 'bg-black/5'}`}>1</span> {t.sec1}
            </h2>
            <div className="flex flex-col gap-3">
              <select 
                value={scriptTheme} onChange={(e) => setScriptTheme(e.target.value)}
                className={`w-full border rounded-xl p-3 text-sm ${activeTheme.inputClass}`}
              >
                {SCRIPT_THEMES.map(st => <option key={st.id} value={st.id}>{t[st.labelKey]}</option>)}
              </select>
              <div className="relative">
                <input 
                  type="text" placeholder={t.placeholderTopic} value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)}
                  className={`w-full border rounded-xl p-3 text-sm ${activeTheme.inputClass}`}
                />
                <button onClick={handleSuggestTitle} className="absolute right-2 top-2 text-[10px] p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20">{isGeneratingTitle ? t.suggestLoading : t.btnSuggest}</button>
                {suggestedTitles.length > 0 && (
                  <div className={`absolute z-20 w-full mt-1 border rounded-xl shadow-2xl overflow-hidden ${activeTheme.isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'}`}>
                    {suggestedTitles.map((suggest, i) => <button key={i} onClick={() => handleSelectTitle(suggest)} className="w-full text-left px-4 py-2 text-xs hover:bg-blue-500/10 border-b last:border-0">{suggest}</button>)}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] opacity-40 uppercase font-bold block">{t.lblPara}</label>
                    <span className="text-[10px] font-bold bg-blue-500/10 px-2 py-0.5 rounded-full">{paragraphCount}</span>
                  </div>
                  <input type="range" min="1" max="10" step="1" value={paragraphCount} onChange={(e) => setParagraphCount(parseInt(e.target.value))} className="w-full accent-blue-500 h-1 rounded-lg cursor-pointer" />
                </div>
                <div>
                  <label className="text-[10px] opacity-40 uppercase font-bold block mb-1">{t.lblVisual}</label>
                  <select value={imageCount} onChange={(e) => setImageCount(parseInt(e.target.value))} className={`w-full border rounded-lg p-1 text-xs ${activeTheme.inputClass}`}>
                    {[1, 2, 3, 5, 10].map(n => <option key={n} value={n}>{n} {t.lblGallery}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2">
                <button disabled={isGeneratingScript} onClick={handleGenerateScript} className="py-2 bg-blue-500/10 hover:bg-blue-500/20 rounded-xl text-[10px] font-bold">{isGeneratingScript ? '⏳...' : t.btnScript}</button>
                <button disabled={isGeneratingImage} onClick={handleGenerateVisual} className="py-2 bg-purple-500/10 hover:bg-purple-500/20 rounded-xl text-[10px] font-bold">{isGeneratingImage ? '⏳...' : t.btnVisual}</button>
              </div>
            </div>
          </section>

          <hr className="opacity-10" />

          <div className="flex flex-col gap-2">
            <label className="text-[10px] opacity-40 uppercase font-bold block">{t.langLabel}</label>
            <div className="relative">
              <select 
                value={language} 
                onChange={(e) => setLanguage(e.target.value)}
                className={`w-full border rounded-xl p-3 text-sm appearance-none cursor-pointer ${activeTheme.inputClass}`}
              >
                {LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.icon} {l.label}</option>)}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-40 text-[8px]">▼</div>
            </div>
          </div>

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider mb-3 opacity-70 flex items-center gap-2">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${activeTheme.isDark ? 'bg-white/10' : 'bg-black/5'}`}>2</span> {t.sec2}
            </h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-[10px] opacity-40 uppercase font-bold mb-1 block">{t.lblVoice}</label>
                <select value={selectedVoice.id} onChange={(e) => setSelectedVoice(VOICES.find(v => v.id === e.target.value)!)} className={`w-full border rounded-xl p-3 text-sm ${activeTheme.inputClass}`}>
                  <optgroup label="👨 Male">{maleVoices.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}</optgroup>
                  <optgroup label="👩 Female">{femaleVoices.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}</optgroup>
                </select>
              </div>

              <div>
                <label className="text-[10px] opacity-40 uppercase font-bold mb-1 block">{t.lblStyle}</label>
                <div className="grid grid-cols-3 gap-2">
                  {SPEECH_STYLES.map(style => (
                    <button
                      key={style.id} onClick={() => setSpeechStyle(style.id)}
                      className={`p-2 rounded-xl border text-[10px] flex flex-col items-center gap-1 transition-all ${speechStyle === style.id ? 'bg-blue-500 text-white border-blue-600 scale-105 shadow-md' : 'opacity-60 hover:opacity-100 bg-black/5 border-transparent'}`}
                    >
                      <span className="text-base">{style.icon}</span>
                      <span className="text-center leading-tight">{style.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] opacity-40 uppercase font-bold mb-1 block">{t.lblEmotion}</label>
                <select value={emotion} onChange={(e) => setEmotion(e.target.value)} className={`w-full border rounded-xl p-3 text-sm ${activeTheme.inputClass}`}>
                  {EMOTIONS.map(emo => <option key={emo.id} value={emo.id}>{emo.icon} {emo.label}</option>)}
                </select>
              </div>
            </div>
          </section>
        </aside>

        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className={`relative overflow-hidden rounded-3xl border min-h-[300px] flex flex-col ${activeTheme.cardClass}`}>
            <div className="flex justify-between items-center p-4 border-b border-black/5 dark:border-white/5">
              <h3 className="text-sm font-bold uppercase tracking-wider opacity-70">{t.lblGallery}</h3>
              {imageUrls.length > 0 && (
                <div className="flex gap-2">
                  <button onClick={() => setImageUrls([])} className="px-4 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[10px] font-bold">{t.btnDeleteGallery}</button>
                </div>
              )}
            </div>
            <div className="flex-1 flex items-center justify-center p-4">
              {isGeneratingImage ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-[10px] font-bold animate-pulse">MEMBUAT VISUAL ({imageUrls.length}/{imageCount})</p>
                </div>
              ) : imageUrls.length > 0 ? (
                <div className="grid w-full gap-4 grid-cols-2 md:grid-cols-3">
                  {imageUrls.map((url, index) => (
                    <div key={index} className="relative group overflow-hidden rounded-2xl aspect-video bg-black/10">
                      <img src={url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    </div>
                  ))}
                </div>
              ) : <div className="text-center p-12 opacity-20"><span className="text-6xl block mb-4">🖼️</span><p className="text-sm font-bold uppercase">{t.lblGallery}</p></div>}
            </div>
          </div>

          <div className={`p-8 rounded-3xl border flex flex-col gap-6 ${activeTheme.cardClass}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={`p-4 rounded-2xl border-2 border-dashed transition-all hover:border-red-500/40 ${activeTheme.isDark ? 'border-white/10 bg-white/5' : 'border-black/5 bg-black/5'}`}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-red-500 animate-pulse">{t.hookTitle}</span>
                  <button onClick={handleGenerateBombastic} disabled={isGeneratingBombastic} className="text-[10px] font-bold bg-blue-500 text-white px-3 py-1 rounded-full">{isGeneratingBombastic ? '⏳' : t.titleLabel}</button>
                </div>
                <p className="text-sm font-bold italic opacity-90 leading-tight">{bombasticTitle || t.hookSub}</p>
              </div>
              <div className={`p-4 rounded-2xl border-2 border-dashed transition-all hover:border-amber-500/40 ${activeTheme.isDark ? 'border-amber-400/20 bg-amber-400/5' : 'border-amber-500/10 bg-amber-500/5'}`}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">{t.thumbTitle}</span>
                  <button onClick={() => handleGenerateThumbnail()} disabled={isGeneratingThumbnail} className="text-[10px] font-bold bg-amber-500 text-white px-3 py-1 rounded-full">{isGeneratingThumbnail ? '⏳' : t.thumbTextLabel}</button>
                </div>
                <p className="text-sm font-black uppercase text-amber-600 dark:text-amber-400 tracking-tight">{thumbnailText || t.thumbSub}</p>
              </div>
            </div>

            <div className="flex-1 flex flex-col gap-3">
              <div className="flex justify-between"><label className="text-sm font-bold uppercase tracking-wider opacity-70">{t.sec1}</label><button onClick={() => setInputText("")} className="text-[10px] text-red-500 font-bold">{t.clear}</button></div>
              <textarea placeholder={t.placeholderScript} value={inputText} onChange={(e) => setInputText(e.target.value)} className="w-full h-48 bg-transparent border-0 focus:ring-0 resize-none text-lg font-light leading-relaxed" />
            </div>

            <div className="flex flex-col gap-4">
              <button disabled={audioState.isLoading || !inputText.trim()} onClick={handleGenerateFull} className={`w-full py-5 rounded-2xl flex items-center justify-center gap-3 text-lg font-bold transition-all disabled:opacity-30 ${activeTheme.accentClass}`}>{audioState.isLoading ? <span className="animate-spin text-2xl">⏳</span> : <span>🎙️ {t.btnStudio}</span>}</button>
              {audioUrl && !audioState.isLoading && (
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={playPreview} className="py-4 rounded-xl font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border">{audioState.isPlaying ? t.btnStop : t.btnPlay}</button>
                  <button onClick={() => {
                    const link = document.createElement('a');
                    link.href = audioUrl;
                    link.download = `${projectTitle || 'audio'}.mp3`;
                    link.click();
                  }} className="py-4 rounded-xl font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg">{t.btnSave}</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <footer className="mt-8 pb-8 text-center opacity-30 text-[10px] uppercase tracking-widest">&copy; 2024 {t.appName} • Syarif Hidayatullah</footer>
    </div>
  );
};

export default App;
