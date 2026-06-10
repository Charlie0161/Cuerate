import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  GearItem,
  ConnectionType,
  CompatibilityWarning,
  analyzeRig,
  getTotalPowerDraw,
} from '../data/gearDatabase';

export type RigMode = 'home' | 'gig';

export interface GigProfile {
  id: string;
  name: string; // e.g. "Pub Gig", "Festival", "Wedding"
  controller: GearItem | null;
  speakers: GearItem[];
  activeConnections: Record<string, ConnectionType>;
  mixer: GearItem | null;
  createdAt: number;
}

interface RigState {
  mode: RigMode;

  // Home setup
  homeController: GearItem | null;
  homeSpeakers: GearItem[];
  homeConnections: Record<string, ConnectionType>;
  homeLaptop: GearItem | null;
  homeHeadphones: GearItem | null;

  // Gig profiles
  gigProfiles: GigProfile[];
  activeGigId: string | null;

  // Computed
  warnings: CompatibilityWarning[];
  totalPowerDraw: number;

  // Actions
  setMode: (mode: RigMode) => void;

  // Home actions
  setHomeController: (gear: GearItem | null) => void;
  addHomeSpeaker: (gear: GearItem) => void;
  removeHomeSpeaker: (id: string) => void;
  setHomeConnection: (speakerId: string, conn: ConnectionType) => void;
  setHomeLaptop: (gear: GearItem | null) => void;
  setHomeHeadphones: (gear: GearItem | null) => void;

  // Gig profile actions
  createGigProfile: (name: string) => string;
  deleteGigProfile: (id: string) => void;
  setActiveGig: (id: string) => void;
  updateGigController: (gigId: string, gear: GearItem | null) => void;
  addGigSpeaker: (gigId: string, gear: GearItem) => void;
  removeGigSpeaker: (gigId: string, speakerId: string) => void;
  setGigConnection: (gigId: string, speakerId: string, conn: ConnectionType) => void;
  setGigMixer: (gigId: string, gear: GearItem | null) => void;
  renameGigProfile: (gigId: string, name: string) => void;

  recalculate: () => void;
}

function defaultConnForSpeaker(gear: GearItem): ConnectionType {
  const preferred: ConnectionType[] = ['xlr', 'trs', 'rca', 'optical', 'hdmi', 'bluetooth'];
  return preferred.find(c => gear.connections.includes(c)) ?? gear.connections[0];
}

export const useRigStore = create<RigState>()(
  persist(
    (set, get) => ({
      mode: 'home',
      homeController: null,
      homeSpeakers: [],
      homeConnections: {},
      homeLaptop: null,
      homeHeadphones: null,
      gigProfiles: [],
      activeGigId: null,
      warnings: [],
      totalPowerDraw: 0,

      setMode: (mode) => {
        set({ mode });
        get().recalculate();
      },

      setHomeController: (gear) => { set({ homeController: gear }); get().recalculate(); },

      addHomeSpeaker: (gear) => {
        const { homeSpeakers, homeConnections } = get();
        if (homeSpeakers.find(s => s.id === gear.id)) return;
        set({
          homeSpeakers: [...homeSpeakers, gear],
          homeConnections: { ...homeConnections, [gear.id]: defaultConnForSpeaker(gear) },
        });
        get().recalculate();
      },

      removeHomeSpeaker: (id) => {
        set(state => {
          const conns = { ...state.homeConnections };
          delete conns[id];
          return { homeSpeakers: state.homeSpeakers.filter(s => s.id !== id), homeConnections: conns };
        });
        get().recalculate();
      },

      setHomeConnection: (speakerId, conn) => {
        set(state => ({ homeConnections: { ...state.homeConnections, [speakerId]: conn } }));
        get().recalculate();
      },

      setHomeLaptop: (gear) => { set({ homeLaptop: gear }); get().recalculate(); },
      setHomeHeadphones: (gear) => { set({ homeHeadphones: gear }); get().recalculate(); },

      createGigProfile: (name) => {
        const id = `gig-${Date.now()}`;
        const profile: GigProfile = {
          id, name,
          controller: null,
          speakers: [],
          activeConnections: {},
          mixer: null,
          createdAt: Date.now(),
        };
        set(state => ({
          gigProfiles: [...state.gigProfiles, profile],
          activeGigId: id,
        }));
        get().recalculate();
        return id;
      },

      deleteGigProfile: (id) => {
        set(state => {
          const profiles = state.gigProfiles.filter(p => p.id !== id);
          return {
            gigProfiles: profiles,
            activeGigId: state.activeGigId === id ? (profiles[0]?.id ?? null) : state.activeGigId,
          };
        });
        get().recalculate();
      },

      setActiveGig: (id) => { set({ activeGigId: id }); get().recalculate(); },

      renameGigProfile: (gigId, name) => {
        set(state => ({
          gigProfiles: state.gigProfiles.map(p => p.id === gigId ? { ...p, name } : p),
        }));
      },

      updateGigController: (gigId, gear) => {
        set(state => ({
          gigProfiles: state.gigProfiles.map(p => p.id === gigId ? { ...p, controller: gear } : p),
        }));
        get().recalculate();
      },

      addGigSpeaker: (gigId, gear) => {
        set(state => ({
          gigProfiles: state.gigProfiles.map(p => {
            if (p.id !== gigId || p.speakers.find(s => s.id === gear.id)) return p;
            return {
              ...p,
              speakers: [...p.speakers, gear],
              activeConnections: { ...p.activeConnections, [gear.id]: defaultConnForSpeaker(gear) },
            };
          }),
        }));
        get().recalculate();
      },

      removeGigSpeaker: (gigId, speakerId) => {
        set(state => ({
          gigProfiles: state.gigProfiles.map(p => {
            if (p.id !== gigId) return p;
            const conns = { ...p.activeConnections };
            delete conns[speakerId];
            return { ...p, speakers: p.speakers.filter(s => s.id !== speakerId), activeConnections: conns };
          }),
        }));
        get().recalculate();
      },

      setGigConnection: (gigId, speakerId, conn) => {
        set(state => ({
          gigProfiles: state.gigProfiles.map(p =>
            p.id === gigId
              ? { ...p, activeConnections: { ...p.activeConnections, [speakerId]: conn } }
              : p
          ),
        }));
        get().recalculate();
      },

      setGigMixer: (gigId, gear) => {
        set(state => ({
          gigProfiles: state.gigProfiles.map(p => p.id === gigId ? { ...p, mixer: gear } : p),
        }));
        get().recalculate();
      },

      recalculate: () => {
        const state = get();
        if (state.mode === 'home') {
          const warnings = analyzeRig(
            state.homeController,
            state.homeSpeakers,
            state.homeConnections,
            state.homeHeadphones,
            state.homeLaptop,
          );
          const allGear = [
            state.homeController,
            state.homeLaptop,
            state.homeHeadphones,
            ...state.homeSpeakers,
          ].filter(Boolean) as GearItem[];
          set({ warnings, totalPowerDraw: getTotalPowerDraw(allGear) });
        } else {
          const activeGig = state.gigProfiles.find(p => p.id === state.activeGigId);
          if (!activeGig) { set({ warnings: [], totalPowerDraw: 0 }); return; }
          const warnings = analyzeRig(
            activeGig.controller,
            activeGig.speakers,
            activeGig.activeConnections,
          );
          const allGear = [
            activeGig.controller,
            activeGig.mixer,
            ...activeGig.speakers,
          ].filter(Boolean) as GearItem[];
          set({ warnings, totalPowerDraw: getTotalPowerDraw(allGear) });
        }
      },
    }),
    {
      name: 'boothbuddy-rig-v2',
      storage: createJSONStorage(() => {
        try { return localStorage; } catch { return sessionStorage; }
      }),
    },
  ),
);
