import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Запись голоса через MediaRecorder (WebM/Opus в Chrome).
 * Опционально: Web Speech API для черновика транскрипции (ru-RU).
 */
export default function VoiceRecorder({ onRecorded, onTranscript, disabled = false, className = "" }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const recognitionRef = useRef(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const mimeRef = useRef("audio/webm");

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          /* ignore */
        }
      }
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try {
          recorderRef.current.stop();
        } catch {
          /* ignore */
        }
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecognition = useCallback(() => {
    const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR || !onTranscript) return;
    try {
      const rec = new SR();
      rec.lang = "ru-RU";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.continuous = true;
      rec.onresult = (ev) => {
        let text = "";
        for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
          text += ev.results[i][0].transcript;
        }
        if (text.trim()) onTranscript(text.trim());
      };
      rec.onerror = () => {};
      rec.start();
      recognitionRef.current = rec;
    } catch {
      /* нет API */
    }
  }, [onTranscript]);

  const stopRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    }
  }, []);

  const startRecording = async () => {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Браузер не поддерживает запись с микрофона");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      mimeRef.current = mime;

      const mr = new MediaRecorder(stream, { mimeType: mime });
      recorderRef.current = mr;
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeRef.current });
        if (blob.size > 0 && onRecorded) onRecorded(blob, mimeRef.current);
        chunksRef.current = [];
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        recorderRef.current = null;
      };
      mr.start(200);

      setRecording(true);
      setSeconds(0);
      stopTimer();
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      startRecognition();
    } catch (e) {
      setError(e?.message || "Не удалось получить доступ к микрофону");
    }
  };

  const stopRecording = useCallback(() => {
    stopRecognition();
    stopTimer();
    setRecording(false);
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        recorderRef.current.stop();
      } catch {
        /* ignore */
      }
    } else if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, [stopTimer, stopRecognition]);

  return (
    <div className={`voice-recorder ${className}`.trim()}>
      <div className="voice-recorder-row">
        {!recording ? (
          <button type="button" className="ghost voice-btn" onClick={startRecording} disabled={disabled}>
            Записать голосовое
          </button>
        ) : (
          <button type="button" className="primary voice-btn" onClick={stopRecording}>
            Остановить ({seconds} сек)
          </button>
        )}
      </div>
      {error ? <p className="auth-message">{error}</p> : null}
      <p className="file-note">
        После публикации объявления запись будет отправлена на сервер. При поддержке браузера текст можно дополнить
        распознаванием речи.
      </p>
    </div>
  );
}
