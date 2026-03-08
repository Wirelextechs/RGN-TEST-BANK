"use client";

import { useAuth } from "@/hooks/useAuth";
import { JitsiMeeting } from '@jitsi/react-sdk';
import { useState } from "react";
import styles from "./VideoClass.module.css";
import { Video, Shield } from "lucide-react";
import { Button } from "@/components/ui/Button";

export const VideoClass = () => {
    const { profile, user } = useAuth();
    const [hasJoined, setHasJoined] = useState(false);

    if (!profile || !user) return null;

    const isStaff = profile.role === 'admin' || profile.role === 'ta';
    // Using a static room name for the main class, could be fetched from DB
    const roomName = "RGN_Live_Classroom_Official_Stream";

    // If student, they join muted and without camera by default to act as viewers
    const configOverwrite = isStaff ? {
        startWithAudioMuted: false,
        startWithVideoMuted: false,
    } : {
        startWithAudioMuted: true,
        startWithVideoMuted: true,
        disableDeepLinking: true,
        prejoinPageEnabled: false,
    };

    const interfaceConfigOverwrite = isStaff ? {
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        TOOLBAR_BUTTONS: [
            'microphone', 'camera', 'desktop', 'fullscreen',
            'fodeviceselection', 'hangout', 'profile', 'settings',
            'videoquality', 'filmstrip', 'tileview'
        ],
    } : {
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        // Students shouldn't see mic/camera buttons if they are just viewers
        TOOLBAR_BUTTONS: [
            'fullscreen', 'videoquality', 'filmstrip', 'tileview', 'hangout'
        ],
    };

    if (!hasJoined) {
        return (
            <div className={styles.joinContainer}>
                <div className={styles.joinCard}>
                    {isStaff ? <Shield size={48} color="var(--primary)" /> : <Video size={48} color="var(--primary)" />}
                    <h2>Live Classroom</h2>
                    <p>{isStaff ? "Start the stream for students. You will have full access to broadcast your camera, microphone, and screen." : "Join the interactive live class as a viewer. Your microphone and camera will be disabled."}</p>
                    <Button onClick={() => setHasJoined(true)} variant="primary" size="lg" style={{ marginTop: '1rem' }}>
                        {isStaff ? "Start Broadcast" : "Join Class"}
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.videoContainer}>
            <JitsiMeeting
                domain="meet.jit.si"
                roomName={roomName}
                userInfo={{
                    displayName: profile.full_name,
                    email: profile.email || user.email || ''
                }}
                configOverwrite={configOverwrite}
                interfaceConfigOverwrite={interfaceConfigOverwrite}
                getIFrameRef={(iframeRef) => {
                    iframeRef.style.height = '100%';
                    iframeRef.style.width = '100%';
                    iframeRef.style.border = 'none';
                }}
            />
        </div>
    );
};
