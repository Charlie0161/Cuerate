import React, { useState } from 'react';
import {
  View, Text, Modal, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, Switch, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

const C = {
  bg: '#0A0A0C', surface: '#13131A', raised: '#1C1C26',
  border: '#2A2A38', accent: '#7C5CFC', accentDim: '#3D2E8A',
  success: '#4DCC8F', text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
};

interface AddVenueModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddVenueModal({ onClose, onSuccess }: AddVenueModalProps) {
  const { user } = useAuthStore();
  const [name, setName]           = useState('');
  const [city, setCity]           = useState('');
  const [address, setAddress]     = useState('');
  const [capacity, setCapacity]   = useState('');
  const [description, setDesc]    = useState('');
  const [website, setWebsite]     = useState('');
  const [bookingEmail, setBooking]= useState('');
  const [instagram, setInsta]     = useState('');
  const [gearText, setGearText]   = useState('');
  const [hasPioneer, setHasPioneer] = useState(false);
  const [hasDenon, setHasDenon]     = useState(false);
  const [hasAllenHeath, setHasAH]   = useState(false);
  const [loading, setLoading]       = useState(false);

  async function handleSubmit() {
    if (!name.trim() || !city.trim()) {
      Alert.alert('Required fields', 'Venue name and city are required.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('venues').insert({
        owner_id:        user?.id ?? null,
        name:            name.trim(),
        city:            city.trim(),
        address:         address.trim() || null,
        capacity:        capacity ? parseInt(capacity) : null,
        description:     description.trim() || null,
        website_url:     website.trim() || null,
        booking_email:   bookingEmail.trim() || null,
        instagram_url:   instagram.trim() || null,
        gear_provided:   gearText.trim() || null,
        has_pioneer:     hasPioneer,
        has_denon:       hasDenon,
        has_allen_heath: hasAllenHeath,
      });
      if (error) throw error;
      onSuccess();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not add venue.');
    } finally {
      setLoading(false);
    }
  }

  const Field = ({ label, value, onChange, placeholder, keyboard = 'default', multiline = false }: any) => (
    <View style={a.fieldWrap}>
      <Text style={a.fieldLabel}>{label}</Text>
      <TextInput
        style={[a.field, multiline && { height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
        value={value} onChangeText={onChange}
        placeholder={placeholder} placeholderTextColor={C.textMuted}
        keyboardType={keyboard} multiline={multiline}
        autoCapitalize={keyboard === 'email-address' ? 'none' : 'words'}
        autoCorrect={false}
      />
    </View>
  );

  const Toggle = ({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) => (
    <View style={a.toggleRow}>
      <Text style={a.toggleLabel}>{label}</Text>
      <Switch
        value={value} onValueChange={onChange}
        trackColor={{ false: C.border, true: C.accentDim }}
        thumbColor={value ? C.accent : C.textMuted}
      />
    </View>
  );

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={a.header}>
          <Text style={a.title}>Add a venue</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={C.textSec} />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={a.sectionLabel}>Basic info</Text>
          <Field label="Venue name *" value={name} onChange={setName} placeholder="e.g. Fabric" />
          <Field label="City *" value={city} onChange={setCity} placeholder="e.g. London" />
          <Field label="Address" value={address} onChange={setAddress} placeholder="Street address" />
          <Field label="Capacity" value={capacity} onChange={setCapacity} placeholder="e.g. 2500" keyboard="number-pad" />

          <Text style={[a.sectionLabel, { marginTop: 16 }]}>About</Text>
          <Field label="Description" value={description} onChange={setDesc}
            placeholder="Tell DJs what to expect..." multiline />

          <Text style={[a.sectionLabel, { marginTop: 16 }]}>Equipment</Text>
          <Field label="Gear provided (free text)" value={gearText} onChange={setGearText}
            placeholder="e.g. CDJ-3000 x2, DJM-900NXS2" multiline />
          <Toggle label="Pioneer equipment" value={hasPioneer} onChange={setHasPioneer} />
          <Toggle label="Denon equipment"   value={hasDenon}   onChange={setHasDenon} />
          <Toggle label="Allen & Heath"     value={hasAllenHeath} onChange={setHasAH} />

          <Text style={[a.sectionLabel, { marginTop: 16 }]}>Contact</Text>
          <Field label="Website" value={website} onChange={setWebsite}
            placeholder="https://venue.com" keyboard="url" />
          <Field label="Booking email" value={bookingEmail} onChange={setBooking}
            placeholder="bookings@venue.com" keyboard="email-address" />
          <Field label="Instagram URL" value={instagram} onChange={setInsta}
            placeholder="https://instagram.com/venue" keyboard="url" />

          <TouchableOpacity
            style={[a.submitBtn, loading && { opacity: 0.6 }]}
            onPress={handleSubmit} disabled={loading}
          >
            <Ionicons name="add-circle-outline" size={18} color="#fff" />
            <Text style={a.submitBtnText}>{loading ? 'Adding…' : 'Add venue'}</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const a = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  title: { fontSize: 18, fontWeight: '700', color: C.text },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  fieldWrap: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: C.textSec, marginBottom: 6 },
  field: { backgroundColor: C.raised, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, height: 46, fontSize: 14, color: C.text },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  toggleLabel: { fontSize: 14, color: C.text },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.accent, borderRadius: 12, paddingVertical: 14, marginTop: 24 },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
