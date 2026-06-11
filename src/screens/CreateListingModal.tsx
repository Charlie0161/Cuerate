import React, { useState, useMemo } from 'react';
import {
  View, Text, Modal, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, Alert, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { GEAR_DATABASE, GearItem } from '../data/gearDatabase';
import { Condition, CONDITION_LABELS } from './MarketplaceScreen';

const C = {
  bg: '#0A0A0C', surface: '#13131A', raised: '#1C1C26',
  border: '#2A2A38', accent: '#7C5CFC', accentDim: '#3D2E8A',
  success: '#4DCC8F', warning: '#F5A623', critical: '#FF4D4D',
  text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
};

const CATEGORY_LABELS: Record<string, string> = {
  controller: 'DJ Controller', mixer: 'Mixer', cdj: 'CDJ / Standalone',
  speaker: 'Speaker', subwoofer: 'Subwoofer', headphones: 'Headphones',
  laptop: 'Laptop', amplifier: 'Amplifier',
};

const CONDITIONS: Condition[] = ['mint', 'excellent', 'good', 'fair', 'spares'];
const CONDITION_DESCRIPTIONS: Record<Condition, string> = {
  mint:      'Like new, unused or barely used',
  excellent: 'Light use, no marks or scratches',
  good:      'Normal use, minor signs of wear',
  fair:      'Heavy use, visible wear but fully working',
  spares:    'For parts or repair only',
};

interface CreateListingModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'gear' | 'details' | 'contact';

export default function CreateListingModal({ onClose, onSuccess }: CreateListingModalProps) {
  const { user, profile } = useAuthStore();
  const [step, setStep]           = useState<Step>('gear');

  // Step 1 — gear selection
  const [gearQuery, setGearQuery] = useState('');
  const [selectedGear, setSelectedGear] = useState<GearItem | null>(null);

  // Step 2 — listing details
  const [price, setPrice]           = useState('');
  const [condition, setCondition]   = useState<Condition>('good');
  const [description, setDesc]      = useState('');
  const [location, setLocation]     = useState(profile?.location ?? '');
  const [includes, setIncludes]     = useState('');

  // Step 3 — contact
  const [contactMethod, setContactMethod] = useState<'app' | 'email' | 'whatsapp'>('app');
  const [contactValue, setContactValue]   = useState('');
  const [loading, setLoading]             = useState(false);

  const filteredGear = useMemo(() =>
    GEAR_DATABASE.filter(g =>
      !gearQuery || `${g.brand} ${g.model} ${g.category}`.toLowerCase().includes(gearQuery.toLowerCase())
    ).slice(0, 30),
  [gearQuery]);

  async function handleSubmit() {
    if (!selectedGear) return;
    const priceInt = Math.round(parseFloat(price.replace('£', '').replace(',', '')) * 100);
    if (!priceInt || priceInt <= 0) { Alert.alert('Invalid price', 'Please enter a valid price.'); return; }
    if (contactMethod !== 'app' && !contactValue.trim()) {
      Alert.alert('Contact required', `Please enter your ${contactMethod === 'email' ? 'email address' : 'WhatsApp number'}.`);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('gear_listings').insert({
        seller_id:      user!.id,
        gear_id:        selectedGear.id,
        brand:          selectedGear.brand,
        model:          selectedGear.model,
        category:       selectedGear.category,
        price:          priceInt,
        condition,
        description:    description.trim() || null,
        location:       location.trim() || null,
        includes:       includes.trim() || null,
        contact_method: contactMethod,
        contact_value:  contactValue.trim() || null,
      });
      if (error) throw error;
      onSuccess();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not create listing.');
    } finally {
      setLoading(false);
    }
  }

  // ── Step indicators ─────────────────────────────────────────────────────────

  const STEPS: { key: Step; label: string }[] = [
    { key: 'gear', label: 'Select gear' },
    { key: 'details', label: 'Details' },
    { key: 'contact', label: 'Contact' },
  ];

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        {/* Header */}
        <View style={c.header}>
          <Text style={c.title}>List your gear</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={C.textSec} />
          </TouchableOpacity>
        </View>

        {/* Step indicator */}
        <View style={c.stepRow}>
          {STEPS.map((s, i) => {
            const active  = s.key === step;
            const done    = STEPS.findIndex(x => x.key === step) > i;
            return (
              <React.Fragment key={s.key}>
                {i > 0 && <View style={[c.stepLine, done && c.stepLineDone]} />}
                <TouchableOpacity
                  style={[c.stepDot, active && c.stepDotActive, done && c.stepDotDone]}
                  onPress={() => done && setStep(s.key)}
                >
                  {done ? (
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  ) : (
                    <Text style={[c.stepNum, active && c.stepNumActive]}>{i + 1}</Text>
                  )}
                </TouchableOpacity>
                <Text style={[c.stepLabel, active && c.stepLabelActive]}>{s.label}</Text>
              </React.Fragment>
            );
          })}
        </View>

        {/* ── Step 1: Gear selection ── */}
        {step === 'gear' && (
          <>
            <View style={c.searchBar}>
              <Ionicons name="search-outline" size={16} color={C.textMuted} />
              <TextInput
                style={c.searchInput}
                value={gearQuery}
                onChangeText={setGearQuery}
                placeholder="Search your gear…"
                placeholderTextColor={C.textMuted}
                autoFocus
              />
            </View>
            <FlatList
              data={filteredGear}
              keyExtractor={item => item.id}
              contentContainerStyle={{ paddingBottom: 40 }}
              renderItem={({ item }) => {
                const selected = selectedGear?.id === item.id;
                return (
                  <TouchableOpacity
                    style={[c.gearRow, selected && c.gearRowSelected]}
                    onPress={() => setSelectedGear(item)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={c.gearCat}>{CATEGORY_LABELS[item.category] ?? item.category}</Text>
                      <Text style={c.gearName}>{item.brand} {item.model}</Text>
                      <Text style={c.gearMeta}>
                        {item.powerDraw}W · {item.connections.map(c => c.toUpperCase()).join(', ')}
                      </Text>
                    </View>
                    {selected && <Ionicons name="checkmark-circle" size={20} color={C.accent} />}
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: C.border, marginHorizontal: 16 }} />}
            />
            {selectedGear && (
              <View style={c.nextBar}>
                <View style={{ flex: 1 }}>
                  <Text style={c.nextBarLabel}>Selected</Text>
                  <Text style={c.nextBarValue}>{selectedGear.brand} {selectedGear.model}</Text>
                </View>
                <TouchableOpacity style={c.nextBtn} onPress={() => setStep('details')}>
                  <Text style={c.nextBtnText}>Next</Text>
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* ── Step 2: Listing details ── */}
        {step === 'details' && (
          <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">
            {/* Selected gear summary */}
            {selectedGear && (
              <View style={c.selectedSummary}>
                <View style={{ flex: 1 }}>
                  <Text style={c.selectedBrand}>{selectedGear.brand}</Text>
                  <Text style={c.selectedModel}>{selectedGear.model}</Text>
                </View>
                <TouchableOpacity onPress={() => setStep('gear')}>
                  <Text style={{ fontSize: 12, color: C.accent }}>Change</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Price */}
            <Text style={c.fieldLabel}>Asking price (£) *</Text>
            <View style={c.fieldRow}>
              <Text style={{ fontSize: 18, color: C.textMuted, marginRight: 6 }}>£</Text>
              <TextInput
                style={[c.field, { fontSize: 18, fontWeight: '700' }]}
                value={price} onChangeText={setPrice}
                placeholder="0" placeholderTextColor={C.textMuted}
                keyboardType="decimal-pad"
              />
            </View>

            {/* Condition */}
            <Text style={c.fieldLabel}>Condition *</Text>
            {CONDITIONS.map(cond => (
              <TouchableOpacity
                key={cond}
                style={[c.condRow, condition === cond && c.condRowActive]}
                onPress={() => setCondition(cond)}
              >
                <View style={[c.condRadio, condition === cond && c.condRadioActive]} />
                <View style={{ flex: 1 }}>
                  <Text style={[c.condLabel, condition === cond && { color: C.text }]}>{CONDITION_LABELS[cond]}</Text>
                  <Text style={c.condDesc}>{CONDITION_DESCRIPTIONS[cond]}</Text>
                </View>
              </TouchableOpacity>
            ))}

            {/* Description */}
            <Text style={[c.fieldLabel, { marginTop: 16 }]}>Description</Text>
            <TextInput
              style={[c.field, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
              value={description} onChangeText={setDesc}
              placeholder="Describe the item, any faults, history..."
              placeholderTextColor={C.textMuted}
              multiline
            />

            {/* Includes */}
            <Text style={c.fieldLabel}>What's included</Text>
            <TextInput
              style={c.field}
              value={includes} onChangeText={setIncludes}
              placeholder="e.g. Original box, power cable, carry bag"
              placeholderTextColor={C.textMuted}
            />

            {/* Location */}
            <Text style={c.fieldLabel}>Your location</Text>
            <TextInput
              style={c.field}
              value={location} onChangeText={setLocation}
              placeholder="e.g. London, Manchester"
              placeholderTextColor={C.textMuted}
            />

            <View style={c.navRow}>
              <TouchableOpacity style={c.backBtn} onPress={() => setStep('gear')}>
                <Ionicons name="arrow-back" size={16} color={C.textSec} />
                <Text style={c.backBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={c.nextBtn} onPress={() => {
                if (!price.trim()) { Alert.alert('Price required', 'Please enter a price.'); return; }
                setStep('contact');
              }}>
                <Text style={c.nextBtnText}>Next</Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        {/* ── Step 3: Contact ── */}
        {step === 'contact' && (
          <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">
            <Text style={c.fieldLabel}>How should buyers contact you?</Text>

            {(['app', 'email', 'whatsapp'] as const).map(method => (
              <TouchableOpacity
                key={method}
                style={[c.condRow, contactMethod === method && c.condRowActive]}
                onPress={() => setContactMethod(method)}
              >
                <View style={[c.condRadio, contactMethod === method && c.condRadioActive]} />
                <View style={{ flex: 1 }}>
                  <Text style={[c.condLabel, contactMethod === method && { color: C.text }]}>
                    {method === 'app' ? 'Via Cuerate (coming soon)' : method === 'email' ? 'Email' : 'WhatsApp'}
                  </Text>
                  <Text style={c.condDesc}>
                    {method === 'app'
                      ? 'Buyers message you through the app'
                      : method === 'email'
                      ? 'Buyers can email you directly'
                      : 'Buyers can WhatsApp you directly'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}

            {contactMethod === 'email' && (
              <>
                <Text style={[c.fieldLabel, { marginTop: 16 }]}>Email address</Text>
                <TextInput
                  style={c.field} value={contactValue} onChangeText={setContactValue}
                  placeholder="your@email.com" placeholderTextColor={C.textMuted}
                  keyboardType="email-address" autoCapitalize="none"
                />
              </>
            )}
            {contactMethod === 'whatsapp' && (
              <>
                <Text style={[c.fieldLabel, { marginTop: 16 }]}>WhatsApp number</Text>
                <TextInput
                  style={c.field} value={contactValue} onChangeText={setContactValue}
                  placeholder="+44 7700 000000" placeholderTextColor={C.textMuted}
                  keyboardType="phone-pad"
                />
              </>
            )}

            <View style={[c.navRow, { marginTop: 24 }]}>
              <TouchableOpacity style={c.backBtn} onPress={() => setStep('details')}>
                <Ionicons name="arrow-back" size={16} color={C.textSec} />
                <Text style={c.backBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[c.nextBtn, { flex: 1, justifyContent: 'center' }, loading && { opacity: 0.6 }]}
                onPress={handleSubmit} disabled={loading}
              >
                <Ionicons name="pricetag-outline" size={16} color="#fff" />
                <Text style={c.nextBtnText}>{loading ? 'Publishing…' : 'Publish listing'}</Text>
              </TouchableOpacity>
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const c = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  title: { fontSize: 18, fontWeight: '700', color: C.text },
  stepRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  stepDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.raised, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { borderColor: C.accent, backgroundColor: C.accentDim },
  stepDotDone: { backgroundColor: C.accent, borderColor: C.accent },
  stepNum: { fontSize: 11, fontWeight: '700', color: C.textMuted },
  stepNumActive: { color: C.accent },
  stepLine: { flex: 1, height: 1, backgroundColor: C.border, marginHorizontal: 4 },
  stepLineDone: { backgroundColor: C.accent },
  stepLabel: { fontSize: 10, color: C.textMuted, marginLeft: 4, marginRight: 8 },
  stepLabelActive: { color: C.accent },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 16, backgroundColor: C.raised, borderRadius: 10, paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: C.border },
  searchInput: { flex: 1, fontSize: 15, color: C.text },
  gearRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  gearRowSelected: { backgroundColor: C.accentDim + '20' },
  gearCat: { fontSize: 10, fontWeight: '600', color: C.accent, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  gearName: { fontSize: 15, fontWeight: '600', color: C.text },
  gearMeta: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  nextBar: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface },
  nextBarLabel: { fontSize: 11, color: C.textMuted },
  nextBarValue: { fontSize: 14, fontWeight: '600', color: C.text },
  nextBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.accent, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12 },
  nextBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  selectedSummary: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.raised, borderRadius: 10, borderWidth: 1, borderColor: C.accentDim, padding: 12, marginBottom: 16 },
  selectedBrand: { fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  selectedModel: { fontSize: 15, fontWeight: '700', color: C.text },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: C.textSec, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.raised, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, height: 52, marginBottom: 16 },
  field: { flex: 1, backgroundColor: C.raised, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, height: 46, fontSize: 14, color: C.text, marginBottom: 14 },
  condRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: C.border, marginBottom: 6 },
  condRowActive: { borderColor: C.accent, backgroundColor: C.accentDim + '15' },
  condRadio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: C.border, marginTop: 2 },
  condRadioActive: { borderColor: C.accent, backgroundColor: C.accent },
  condLabel: { fontSize: 14, fontWeight: '600', color: C.textSec },
  condDesc: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  navRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  backBtnText: { fontSize: 14, color: C.textSec, fontWeight: '600' },
});
