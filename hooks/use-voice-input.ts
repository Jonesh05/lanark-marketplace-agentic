"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Voice-to-text for the chat composer. Hybrid by design:
 *
 *  1. Primary: the browser Web Speech API (SpeechRecognition). Instant, free,
 *     on-device, works on Chrome/Edge/Safari (desktop + mobile). Streams interim
 *     text so the user sees words as they speak.
 *  2. Fallback: when Web Speech is unavailable (e.g. Firefox), capture audio via
 *     MediaRecorder and POST it to /api/transcribe (server Whisper). If the
 *     server has no transcription provider, we surface a clear, accessible
 *     message instead of failing silently.
 *
 * The hook is accessible-first: it exposes `listening`, `interim`, `error` and a
 * stable `supported` flag so the UI can render an ARIA live region and a proper
 * pressed/disabled toggle state.
 */

type RecognitionMode = "speech" | "recorder" | "none"

export interface VoiceInput {
  supported: boolean
  mode: RecognitionMode
  listening: boolean
  transcribing: boolean
  interim: string
  error: string | null
  /** start listening; onFinal fires with the recognized text. */
  start: (onFinal: (text: string) => void) => Promise<void>
  stop: () => void
}

function getSpeechRecognition(): any {
  if (typeof window === "undefined") return null
  return (
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition ||
    null
  )
}

export function useVoiceInput(lang = "es-ES"): VoiceInput {
  const [mode, setMode] = useState<RecognitionMode>("none")
  const [listening, setListening] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [interim, setInterim] = useState("")
  const [error, setError] = useState<string | null>(null)

  const recognitionRef = useRef<any>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const onFinalRef = useRef<((t: string) => void) | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    const SR = getSpeechRecognition()
    if (SR) setMode("speech")
    else if (
      typeof navigator !== "undefined" &&
      typeof navigator.mediaDevices?.getUserMedia === "function" &&
      typeof window !== "undefined" &&
      "MediaRecorder" in window
    )
      setMode("recorder")
    else setMode("none")
  }, [])

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        /* noop */
      }
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        recorderRef.current.stop()
      } catch {
        /* noop */
      }
    }
    setListening(false)
  }, [])

  const startSpeech = useCallback(
    async (onFinal: (t: string) => void) => {
      const SR = getSpeechRecognition()
      if (!SR) return
      const recognition = new SR()
      recognition.lang = lang
      recognition.interimResults = true
      recognition.continuous = false
      recognition.maxAlternatives = 1
      recognitionRef.current = recognition

      let finalText = ""
      recognition.onresult = (event: any) => {
        let interimText = ""
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i]
          if (res.isFinal) finalText += res[0].transcript
          else interimText += res[0].transcript
        }
        setInterim(interimText)
      }
      recognition.onerror = (e: any) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          setError("Permiso de micrófono denegado. Actívalo en tu navegador.")
        } else if (e.error === "no-speech") {
          setError("No escuchamos nada. Intenta de nuevo.")
        } else if (e.error !== "aborted") {
          setError("No pudimos usar el micrófono.")
        }
        setListening(false)
      }
      recognition.onend = () => {
        setListening(false)
        setInterim("")
        const text = finalText.trim()
        if (text) onFinal(text)
      }

      setError(null)
      setInterim("")
      try {
        recognition.start()
        setListening(true)
      } catch {
        setError("No pudimos iniciar el micrófono.")
      }
    },
    [lang],
  )

  const startRecorder = useCallback(
    async (onFinal: (t: string) => void) => {
      setError(null)
      onFinalRef.current = onFinal
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        streamRef.current = stream
        const recorder = new MediaRecorder(stream)
        recorderRef.current = recorder
        chunksRef.current = []
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data)
        }
        recorder.onstop = async () => {
          streamRef.current?.getTracks().forEach((t) => t.stop())
          streamRef.current = null
          const blob = new Blob(chunksRef.current, {
            type: recorder.mimeType || "audio/webm",
          })
          if (blob.size === 0) return
          setTranscribing(true)
          try {
            const fd = new FormData()
            fd.append("audio", blob, "speech.webm")
            const res = await fetch("/api/transcribe", { method: "POST", body: fd })
            const json = await res.json().catch(() => ({}))
            if (res.status === 501) {
              setError(
                "La transcripción por voz no está disponible en este navegador. Escribe tu mensaje.",
              )
            } else if (!res.ok) {
              setError(json.error ?? "No pudimos transcribir el audio.")
            } else if (json.text) {
              onFinalRef.current?.(String(json.text).trim())
            }
          } catch {
            setError("No pudimos transcribir el audio.")
          } finally {
            setTranscribing(false)
          }
        }
        recorder.start()
        setListening(true)
      } catch (e: any) {
        if (e?.name === "NotAllowedError")
          setError("Permiso de micrófono denegado. Actívalo en tu navegador.")
        else setError("No pudimos acceder al micrófono.")
        setListening(false)
      }
    },
    [],
  )

  const start = useCallback(
    async (onFinal: (text: string) => void) => {
      if (listening) {
        stop()
        return
      }
      if (mode === "speech") await startSpeech(onFinal)
      else if (mode === "recorder") await startRecorder(onFinal)
      else setError("Tu navegador no soporta entrada por voz.")
    },
    [listening, mode, startSpeech, startRecorder, stop],
  )

  useEffect(() => {
    return () => {
      stop()
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [stop])

  return {
    supported: mode !== "none",
    mode,
    listening,
    transcribing,
    interim,
    error,
    start,
    stop,
  }
}
