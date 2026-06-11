import React, { useState } from 'react';
import {
  View, Text, Modal, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, Switch, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { Venue } from './VenueDirectoryScreen';

const C = {
  bg: '#0A0A0C', surface: '#13131A', raised: '#1C1C26',
  border: '#2A2A38', accent: '#7C5CFC', accentDim: '#3D2E8A',
  success: '#4DCC8F', text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
};

interface Props {
  venue: Venue;
  onClose: () => void;
  onSuccess: (updated: Venue) => void;
}

export default function EditVenueModal({ venue, onClose, onSuccess }: Props) {
  const [name, setName]             = useState(venue.name);
  const [city, setCity]             = useState(venue.city);
  const [address, setAddress]       = useState(venue.address ?? '');
  const [capacity, setCapacity]     = useState(venue.capacity?.toString() ?? '');
  const [description, setDesc]      = useState(venue.description ?? '');
  const [website, setWebsite]       = useState(venue.website_url ?? '');
  const [bookingEmail, setBooking]  = useState(venue.booking_email ?? '');
  const [instagram, setInsta]       = useState(venue.instagram_url ?? '');
  const [gearText, setGearText]     = useState(venue.gear_provided ?? '');
  const [hasPioneer, setHasPioneer] = useState(venue.has_pioneer);
  const [hasDenon, setHasDenon]     = useState(venue.has_denon);
  const [hasAllenHeath, setHasAH]   = useState(venue.has_allen_heath);
  const [loading, setLoading]       = useState(false);

  async function handleSave() {
    if (!name.trim() || !city.trim()) {
      Alert.alert('Required fields', 'Venue name and city are required.');
      return;
    }
    setLoading(true);
    try {
      const updates = {
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
      };
      const { data, error } = await supabase
        .from('venues')
        .update(updates)
        .eq('id', venue.id)
        .select()
        .single();
      if (error) throw error;
      onSuccess(data as Venue);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not save changes.');
    } finally {
      setLoading(false);
    }
  }

  const Field = ({ label, value, onChange, placeholder, keyboard = 'default', multiline = false }: any) => (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={[s.field, multiline && { height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
        value={value} onChangeText={onChange}
        placeholder={placeholder} placeholderTextColor={C.textMuted}
        keyboardType={keyboard} multiline={multiline}
        autoCapitalize={keyboard === 'email-address' || keyboard === 'url' ? 'none' : 'words'}
        autoCorrect={false}
      />
    </View>
  );

  const Toggle = ({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) => (
    <View style={s.toggleRow}>
      <Text style={s.toggleLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange}
        trackColor={{ false: C.border, true: C.accentDim }}
        thumbColor={value ? C.accent : C.textMuted} />
    </View>
  );

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={s.header}>
          <Text style={s.title}>Edit venue</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={C.textSec} />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={s.sectionLabel}>Basic info</Text>
          <Field label="Venue name *" value={name} onChange={setName} placeholder="e.g. Fabric" />
          <Field label="City *" value={city} onChange={setCity} placeholder="e.g. London" />
          <Field label="Address" value={address} onChange={setAddress} placeholder="Street address" />
          <Field label="Capacity" value={capacity} onChange={setCapacity} placeholder="e.g. 2500" keyboard="number-pad" />

          <Text style={[s.sectionLabel, { marginTop: 16 }]}>About</Text>
          <Field label="Description" value={description} onChange={setDesc}
            placeholder="Tell DJs what to expect..." multiline />

          <Text style={[s.sectionLabel, { marginTop: 16 }]}>Equipment</Text>
          <Field label="Gear provided" value={gearText} onChange={setGearText}
            placeholder="e.g. CDJ-3000 x2, DJM-900NXS2" multiline />
          <Toggle label="Pioneer equipment" value={hasPioneer} onChange={setHasPioneer} />
          <Toggle label="Denon equipment"   value={hasDenon}   onChange={setHasDenon} />
          <Toggle label="Allen & Heath"     value={hasAllenHeath} onChange={setHasAH} />

          <Text style={[s.sectionLabel, { marginTop: 16 }]}>Contact</Text>
          <Field label="Website" value={website} onChange={setWebsite}
            placeholder="https://venue.com" keyboard="url" />
          <Field label="Booking email" value={bookingEmail} onChange={setBooking}
            placeholder="bookings@venue.com" keyboard="email-address" />
          <Field label="Instagram URL" value={instagram} onChange={setInsta}
            placeholder="https://instagram.com/venue" keyboard="url" />

          <TouchableOpacity
            style={[s.saveBtn, loading && { opacity: 0.6 }]}
            onPress={handleSave} disabled={loading}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
            <Text style={s.saveBtnText}>{loading ? 'Saving…' : 'Save changes'}</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  title: { fontSize: 18, fontWeight: '700', color: C.text },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  fieldWrap: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: C.textSec, marginBottom: 6 },
  field: { backgroundColor: C.raised, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, height: 46, fontSize: 14, color: C.text },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  toggleLabel: { fontSize: 14, color: C.text },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.accent, borderRadius: 12, paddingVertical: 14, marginTop: 24 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
