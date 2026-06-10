import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, StatusBar, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase, CommunityCost } from '../lib/supabase';

const C = {
  bg: '#0A0A0C', surface: '#13131A', raised: '#1C1C26',
  border: '#2A2A38', accent: '#7C5CFC', accentDim: '#3D2E8A',
  critical: '#FF4D4D', criticalBg: '#1F0E0E',
  warning: '#F5A623', warningBg: '#1F1508',
  success: '#4DCC8F', successBg: '#071A0F',
  info: '#4DB8FF', infoBg: '#0A1929',
  text: '#F0EFF8', textSec: '#8A89A0', textMuted: '#52516A',
};

interface LocalCost {
  id: string;
  name: string;
  cost: number;
  isGear: boolean;
  gigsToAmortize?: number;
}

interface GeneratorPreset {
  name: string; tankLitres: number; hoursPerTank: number;
}

const GENERATOR_PRESETS: GeneratorPreset[] = [
  { name: 'Hyundai HY2000Si', tankLitres: 3.8, hoursPerTank: 5 },
  { name: 'Honda EU22i', tankLitres: 3.1, hoursPerTank: 8.1 },
  { name: 'Honda EU10i', tankLitres: 2.1, hoursPerTank: 8.3 },
  { name: 'Yamaha EF2000iS', tankLitres: 3.3, hoursPerTank: 10.5 },
  { name: 'Kipor IG2000', tankLitres: 4.0, hoursPerTank: 6 },
  { name: 'Custom', tankLitres: 0, hoursPerTank: 0 },
];

function fmt(n: number) {
  return n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 });
}
function num(s: string) {
  const n = parseFloat(s.replace(/[^0-9.]/g, ''));
  return isNaN(n) ? 0 : n;
}

function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <View style={s.sectionHeader}>
      <Ionicons name={icon as any} size={16} color={C.accent} />
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
  );
}

function InputRow({ label, value, onChangeText, prefix = '£', suffix, placeholder = '0.00', hint }: {
  label: string; value: string; onChangeText: (v: string) => void;
  prefix?: string; suffix?: string; placeholder?: string; hint?: string;
}) {
  return (
    <View style={s.inputRow}>
      <View style={s.inputLabelCol}>
        <Text style={s.inputLabel}>{label}</Text>
        {hint && <Text style={s.inputHint}>{hint}</Text>}
      </View>
      <View style={s.inputField}>
        {prefix !== '' && <Text style={s.inputPrefix}>{prefix}</Text>}
        <TextInput style={s.input} value={value} onChangeText={onChangeText}
          keyboardType="decimal-pad" placeholder={placeholder} placeholderTextColor={C.textMuted} />
        {suffix && <Text style={s.inputSuffix}>{suffix}</Text>}
      </View>
    </View>
  );
}

function Toggle({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity style={[s.toggleSwitch, value && s.toggleSwitchOn]} onPress={onToggle}>
      <View style={[s.toggleThumb, value && s.toggleThumbOn]} />
    </TouchableOpacity>
  );
}

export default function GigCalculatorScreen() {
  // Income
  const [gigFee, setGigFee] = useState('');
  const [extraHours, setExtraHours] = useState('');
  const [extraHourRate, setExtraHourRate] = useState('');

  // Travel
  const [distanceMiles, setDistanceMiles] = useState('');
  const [mpg, setMpg] = useState('35');
  const [fuelPrice, setFuelPrice] = useState('1.65');

  // Generator
  const [useGenerator, setUseGenerator] = useState(false);
  const [genPreset, setGenPreset] = useState(0);
  const [customTank, setCustomTank] = useState('');
  const [customHours, setCustomHours] = useState('');
  const [gigHours, setGigHours] = useState('5');
  const [genFuelPrice, setGenFuelPrice] = useState('1.65');
  const [showPresets, setShowPresets] = useState(false);

  // Local costs (gear + manual)
  const [localCosts, setLocalCosts] = useState<LocalCost[]>([
    { id: '1', name: 'DJ Controller', cost: 500, isGear: true, gigsToAmortize: 100 },
  ]);

  // Add cost form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCost, setNewCost] = useState('');
  const [newIsGear, setNewIsGear] = useState(false);
  const [newGigs, setNewGigs] = useState('100');
  const [submitToCommunity, setSubmitToCommunity] = useState(false);
  const [submitterName, setSubmitterName] = useState('');

  // Community costs
  const [communityCosts, setCommunityCosts] = useState<CommunityCost[]>([]);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communityError, setCommunityError] = useState('');
  const [addedCommunityIds, setAddedCommunityIds] = useState<Set<string>>(new Set());
  const [showCommunity, setShowCommunity] = useState(false);
  const [communitySearch, setCommunitySearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Tax
  const [includeTax, setIncludeTax] = useState(true);

  // Load community costs
  const loadCommunityCosts = useCallback(async () => {
    setCommunityLoading(true);
    setCommunityError('');
    try {
      const { data, error } = await supabase
        .from('community_costs')
        .select('*')
        .eq('approved', true)
        .order('use_count', { ascending: false });
      if (error) throw error;
      setCommunityCosts(data ?? []);
    } catch (e: any) {
      setCommunityError('Could not load community costs. Check your connection.');
    } finally {
      setCommunityLoading(false);
    }
  }, []);

  useEffect(() => { loadCommunityCosts(); }, []);

  async function addCommunityItem(item: CommunityCost) {
    if (addedCommunityIds.has(item.id)) return;
    setLocalCosts(prev => [...prev, {
      id: `community-${item.id}`,
      name: item.name,
      cost: item.typical_amount,
      isGear: false,
    }]);
    setAddedCommunityIds(prev => new Set([...prev, item.id]));
    // Increment use_count
    await supabase
      .from('community_costs')
      .update({ use_count: item.use_count + 1 })
      .eq('id', item.id);
  }

  async function submitCost() {
    if (!newName.trim() || num(newCost) === 0) return;
    setSubmitting(true);
    try {
      if (submitToCommunity) {
        const { error } = await supabase.from('community_costs').insert({
          name: newName.trim(),
          typical_amount: num(newCost),
          submitted_by: submitterName.trim() || 'Anonymous',
          approved: false,
        });
        if (error) throw error;
        setSubmitSuccess(true);
        setTimeout(() => setSubmitSuccess(false), 3000);
      }
      setLocalCosts(prev => [...prev, {
        id: Date.now().toString(),
        name: newName.trim(),
        cost: newIsGear ? num(newCost) : num(newCost),
        isGear: newIsGear,
        gigsToAmortize: newIsGear ? num(newGigs) : undefined,
      }]);
      setNewName(''); setNewCost(''); setNewGigs('100');
      setSubmitToCommunity(false); setSubmitterName('');
      setShowAddForm(false);
    } catch {
      setCommunityError('Failed to submit. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Calculations ─────────────────────────────────────────────────────────
  const totalIncome = num(gigFee) + (num(extraHours) * num(extraHourRate));
  const returnMiles = num(distanceMiles) * 2;
  const travelCost = num(mpg) > 0 ? (returnMiles / num(mpg)) * 4.546 * num(fuelPrice) : 0;

  const preset = GENERATOR_PRESETS[genPreset];
  const tankL = preset.name === 'Custom' ? num(customTank) : preset.tankLitres;
  const hoursPerTank = preset.name === 'Custom' ? num(customHours) : preset.hoursPerTank;
  const litresPerHour = hoursPerTank > 0 ? tankL / hoursPerTank : 0;
  const genCost = useGenerator ? litresPerHour * num(gigHours) * num(genFuelPrice) : 0;

  const gearCost = localCosts
    .filter(c => c.isGear && c.gigsToAmortize && c.gigsToAmortize > 0)
    .reduce((sum, c) => sum + c.cost / (c.gigsToAmortize!), 0);

  const otherCost = localCosts
    .filter(c => !c.isGear)
    .reduce((sum, c) => sum + c.cost, 0);

  const totalCosts = travelCost + genCost + gearCost + otherCost;
  const grossProfit = totalIncome - totalCosts;
  const taxAmount = includeTax && grossProfit > 0 ? grossProfit * 0.20 : 0;
  const netProfit = grossProfit - taxAmount;
  const profitColor = netProfit > 0 ? C.success : netProfit < 0 ? C.critical : C.textSec;

  const filteredCommunity = communityCosts.filter(c =>
    communitySearch === '' || c.name.toLowerCase().includes(communitySearch.toLowerCase())
  );

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={communityLoading} onRefresh={loadCommunityCosts} tintColor={C.accent} />}>

        <View style={s.header}>
          <Text style={s.eyebrow}>Gig Calculator</Text>
          <Text style={s.title}>Profit Estimator</Text>
        </View>

        {/* ── INCOME ── */}
        <View style={s.card}>
          <SectionHeader icon="cash-outline" title="Income" />
          <InputRow label="Gig fee" value={gigFee} onChangeText={setGigFee} />
          <InputRow label="Extra hours" value={extraHours} onChangeText={setExtraHours}
            prefix="" suffix="hrs" placeholder="0" hint="Beyond agreed time" />
          <InputRow label="Rate per extra hour" value={extraHourRate} onChangeText={setExtraHourRate} />
          {num(extraHours) > 0 && num(extraHourRate) > 0 && (
            <View style={s.calcHint}>
              <Text style={s.calcHintText}>{num(extraHours)}hrs × {fmt(num(extraHourRate))} = {fmt(num(extraHours) * num(extraHourRate))}</Text>
            </View>
          )}
        </View>

        {/* ── TRAVEL ── */}
        <View style={s.card}>
          <SectionHeader icon="car-outline" title="Travel" />
          <InputRow label="Distance (one way)" value={distanceMiles} onChangeText={setDistanceMiles}
            prefix="" suffix="miles" placeholder="0" hint="Return journey calculated automatically" />
          <InputRow label="Car MPG" value={mpg} onChangeText={setMpg} prefix="" suffix="mpg" placeholder="35" />
          <InputRow label="Fuel price" value={fuelPrice} onChangeText={setFuelPrice} suffix="/litre" />
          {travelCost > 0 && (
            <View style={s.calcHint}>
              <Text style={s.calcHintText}>{returnMiles.toFixed(0)} miles return · {((returnMiles / num(mpg)) * 4.546).toFixed(1)}L = {fmt(travelCost)}</Text>
            </View>
          )}
        </View>

        {/* ── GENERATOR ── */}
        <View style={s.card}>
          <View style={s.rowBetween}>
            <SectionHeader icon="flash-outline" title="Generator fuel" />
            <Toggle value={useGenerator} onToggle={() => setUseGenerator(!useGenerator)} />
          </View>
          {useGenerator && (
            <>
              <TouchableOpacity style={s.presetBtn} onPress={() => setShowPresets(!showPresets)}>
                <Text style={s.presetBtnText}>{preset.name}</Text>
                <Ionicons name={showPresets ? 'chevron-up' : 'chevron-down'} size={14} color={C.textSec} />
              </TouchableOpacity>
              {showPresets && (
                <View style={s.presetList}>
                  {GENERATOR_PRESETS.map((p, i) => (
                    <TouchableOpacity key={p.name}
                      style={[s.presetOpt, genPreset === i && s.presetOptActive]}
                      onPress={() => { setGenPreset(i); setShowPresets(false); }}>
                      <Text style={[s.presetOptName, genPreset === i && { color: C.accent }]}>{p.name}</Text>
                      {p.name !== 'Custom' && <Text style={s.presetOptMeta}>{p.tankLitres}L · {p.hoursPerTank}hrs/tank</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {preset.name === 'Custom' && (
                <>
                  <InputRow label="Tank size" value={customTank} onChangeText={setCustomTank} prefix="" suffix="litres" placeholder="0" />
                  <InputRow label="Hours per tank" value={customHours} onChangeText={setCustomHours} prefix="" suffix="hrs" placeholder="0" />
                </>
              )}
              <InputRow label="Gig duration" value={gigHours} onChangeText={setGigHours} prefix="" suffix="hrs" placeholder="5" />
              <InputRow label="Petrol price" value={genFuelPrice} onChangeText={setGenFuelPrice} suffix="/litre" />
              {genCost > 0 && (
                <View style={s.calcHint}>
                  <Text style={s.calcHintText}>{litresPerHour.toFixed(2)}L/hr × {num(gigHours)}hrs × {fmt(num(genFuelPrice))}/L = {fmt(genCost)}</Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* ── COSTS ── */}
        <View style={s.card}>
          <SectionHeader icon="receipt-outline" title="Costs & gear" />
          <Text style={s.cardSub}>Add one-off costs or gear to amortize. Tap community to browse costs others have shared.</Text>

          {localCosts.map(c => (
            <View key={c.id} style={s.costRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.costName}>{c.name}</Text>
                <Text style={s.costMeta}>
                  {c.isGear && c.gigsToAmortize
                    ? `${fmt(c.cost)} ÷ ${c.gigsToAmortize} gigs = ${fmt(c.cost / c.gigsToAmortize)}/gig`
                    : fmt(c.cost)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setLocalCosts(p => p.filter(x => x.id !== c.id))} hitSlop={12}>
                <Ionicons name="close" size={16} color={C.textMuted} />
              </TouchableOpacity>
            </View>
          ))}

          {/* Add form */}
          {showAddForm ? (
            <View style={s.addForm}>
              <TextInput style={s.addInput} placeholder="Cost name (e.g. Parking, PAT test...)"
                placeholderTextColor={C.textMuted} value={newName} onChangeText={setNewName} />
              <View style={s.addRow}>
                <View style={[s.inputField, { flex: 1 }]}>
                  <Text style={s.inputPrefix}>£</Text>
                  <TextInput style={s.input} placeholder="Amount" placeholderTextColor={C.textMuted}
                    value={newCost} onChangeText={setNewCost} keyboardType="decimal-pad" />
                </View>
              </View>

              {/* Gear toggle */}
              <View style={s.rowBetween}>
                <View>
                  <Text style={s.inputLabel}>This is a gear purchase</Text>
                  <Text style={s.inputHint}>Spreads cost across multiple gigs</Text>
                </View>
                <Toggle value={newIsGear} onToggle={() => setNewIsGear(!newIsGear)} />
              </View>
              {newIsGear && (
                <View style={[s.inputField, { marginTop: 8 }]}>
                  <TextInput style={s.input} placeholder="Spread over how many gigs?" placeholderTextColor={C.textMuted}
                    value={newGigs} onChangeText={setNewGigs} keyboardType="number-pad" />
                  <Text style={s.inputSuffix}>gigs</Text>
                </View>
              )}

              {/* Submit to community */}
              <View style={[s.communitySubmitBox, submitToCommunity && { borderColor: C.accent }]}>
                <View style={s.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.inputLabel}>Share with community</Text>
                    <Text style={s.inputHint}>Others can add this to their gig calc</Text>
                  </View>
                  <Toggle value={submitToCommunity} onToggle={() => setSubmitToCommunity(!submitToCommunity)} />
                </View>
                {submitToCommunity && (
                  <TextInput style={[s.addInput, { marginTop: 10 }]}
                    placeholder="Your name / DJ name (optional)"
                    placeholderTextColor={C.textMuted}
                    value={submitterName} onChangeText={setSubmitterName} />
                )}
                {submitToCommunity && (
                  <Text style={s.moderationNote}>
                    Submissions are reviewed before appearing publicly.
                  </Text>
                )}
              </View>

              {submitSuccess && (
                <View style={[s.calcHint, { borderColor: C.success }]}>
                  <Text style={[s.calcHintText, { color: C.success }]}>Submitted for review. Thanks!</Text>
                </View>
              )}

              <View style={s.addFormActions}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => { setShowAddForm(false); setNewName(''); setNewCost(''); }}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.confirmBtn, submitting && { opacity: 0.5 }]}
                  onPress={submitCost} disabled={submitting}>
                  {submitting
                    ? <ActivityIndicator size="small" color={C.accent} />
                    : <Text style={s.confirmBtnText}>Add cost</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={s.addCostBtns}>
              <TouchableOpacity style={s.addCostBtn} onPress={() => setShowAddForm(true)}>
                <Ionicons name="add" size={14} color={C.accent} />
                <Text style={s.addCostBtnText}>Add cost</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.addCostBtn, showCommunity && { borderColor: C.accent, backgroundColor: C.accentDim + '30' }]}
                onPress={() => setShowCommunity(!showCommunity)}>
                <Ionicons name="people-outline" size={14} color={C.accent} />
                <Text style={s.addCostBtnText}>Community</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Community browser */}
          {showCommunity && !showAddForm && (
            <View style={s.communityPanel}>
              <View style={s.searchBar}>
                <Ionicons name="search" size={14} color={C.textMuted} />
                <TextInput style={s.searchInput} placeholder="Search community costs..."
                  placeholderTextColor={C.textMuted} value={communitySearch} onChangeText={setCommunitySearch} />
              </View>
              {communityLoading ? (
                <ActivityIndicator size="small" color={C.accent} style={{ marginVertical: 16 }} />
              ) : communityError ? (
                <Text style={s.errorText}>{communityError}</Text>
              ) : filteredCommunity.length === 0 ? (
                <Text style={s.emptyText}>No community costs found.</Text>
              ) : (
                filteredCommunity.map(item => {
                  const added = addedCommunityIds.has(item.id);
                  return (
                    <TouchableOpacity key={item.id}
                      style={[s.communityItem, added && s.communityItemAdded]}
                      onPress={() => addCommunityItem(item)}
                      disabled={added}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.communityItemName}>{item.name}</Text>
                        <Text style={s.communityItemMeta}>
                          Typical: {fmt(item.typical_amount)}
                          {item.submitted_by ? ` · by ${item.submitted_by}` : ''}
                          {item.use_count > 0 ? ` · used ${item.use_count}×` : ''}
                        </Text>
                        {item.description && <Text style={s.communityItemDesc}>{item.description}</Text>}
                      </View>
                      <View style={[s.addTag, added && s.addTagDone]}>
                        <Ionicons name={added ? 'checkmark' : 'add'} size={14} color={added ? C.success : C.accent} />
                        <Text style={[s.addTagText, added && { color: C.success }]}>{added ? 'Added' : 'Add'}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}
        </View>

        {/* ── TAX ── */}
        <View style={s.card}>
          <View style={s.rowBetween}>
            <SectionHeader icon="document-text-outline" title="Include tax (20% UK)" />
            <Toggle value={includeTax} onToggle={() => setIncludeTax(!includeTax)} />
          </View>
          {includeTax && <Text style={s.taxNote}>Basic rate self-employment estimate. Consult an accountant for accurate figures.</Text>}
        </View>

        {/* ── BREAKDOWN ── */}
        <View style={[s.card, { borderColor: C.accent + '50' }]}>
          <SectionHeader icon="analytics-outline" title="Breakdown" />
          <View style={s.resultRow}><Text style={s.resultLabel}>Gig fee</Text><Text style={s.resultVal}>{fmt(num(gigFee))}</Text></View>
          {num(extraHours) > 0 && <View style={s.resultRow}><Text style={s.resultLabel}>Extra hours</Text><Text style={s.resultVal}>{fmt(num(extraHours) * num(extraHourRate))}</Text></View>}
          <View style={s.resultRow}><Text style={[s.resultLabel, { color: C.text, fontWeight: '600' }]}>Total income</Text><Text style={[s.resultVal, { color: C.text, fontWeight: '600' }]}>{fmt(totalIncome)}</Text></View>
          <View style={s.divider} />
          {travelCost > 0 && <View style={s.resultRow}><Text style={s.resultLabel}>Travel</Text><Text style={[s.resultVal, { color: C.warning }]}>− {fmt(travelCost)}</Text></View>}
          {genCost > 0 && <View style={s.resultRow}><Text style={s.resultLabel}>Generator</Text><Text style={[s.resultVal, { color: C.warning }]}>− {fmt(genCost)}</Text></View>}
          {gearCost > 0 && <View style={s.resultRow}><Text style={s.resultLabel}>Gear amortization</Text><Text style={[s.resultVal, { color: C.warning }]}>− {fmt(gearCost)}</Text></View>}
          {otherCost > 0 && <View style={s.resultRow}><Text style={s.resultLabel}>Other costs</Text><Text style={[s.resultVal, { color: C.warning }]}>− {fmt(otherCost)}</Text></View>}
          <View style={s.resultRow}><Text style={[s.resultLabel, { color: C.text, fontWeight: '600' }]}>Total costs</Text><Text style={[s.resultVal, { color: C.warning, fontWeight: '600' }]}>− {fmt(totalCosts)}</Text></View>
          <View style={s.divider} />
          <View style={s.resultRow}><Text style={s.resultLabel}>Gross profit</Text><Text style={[s.resultVal, { color: grossProfit >= 0 ? C.success : C.critical }]}>{fmt(grossProfit)}</Text></View>
          {includeTax && taxAmount > 0 && <View style={s.resultRow}><Text style={s.resultLabel}>Tax (20%)</Text><Text style={[s.resultVal, { color: C.critical }]}>− {fmt(taxAmount)}</Text></View>}

          <View style={[s.profitBox, { backgroundColor: netProfit > 0 ? C.successBg : netProfit < 0 ? C.criticalBg : C.surface, borderColor: profitColor }]}>
            <Text style={[s.profitLabel, { color: profitColor }]}>{netProfit >= 0 ? 'Net profit' : 'Net loss'}</Text>
            <Text style={[s.profitValue, { color: profitColor }]}>{fmt(netProfit)}</Text>
          </View>

          {netProfit > 0 && num(gigHours) > 0 && (
            <Text style={s.perHour}>{fmt(netProfit / num(gigHours))} per hour worked</Text>
          )}
          {netProfit < 0 && (
            <View style={s.alertBox}>
              <Ionicons name="alert-circle" size={14} color={C.critical} />
              <Text style={s.alertText}>You need to charge at least {fmt(totalCosts + (includeTax ? totalCosts * 0.20 : 0))} to break even.</Text>
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 16, paddingTop: 8 },
  header: { marginBottom: 20 },
  eyebrow: { fontSize: 11, fontWeight: '600', letterSpacing: 1.2, color: C.accent, textTransform: 'uppercase', marginBottom: 2 },
  title: { fontSize: 28, fontWeight: '700', color: C.text },
  card: { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 16 },
  cardSub: { fontSize: 12, color: C.textMuted, marginBottom: 12, marginTop: -6, lineHeight: 17 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: C.text },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  inputLabelCol: { flex: 1, paddingRight: 12 },
  inputLabel: { fontSize: 13, color: C.text },
  inputHint: { fontSize: 11, color: C.textMuted, marginTop: 1 },
  inputField: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.raised, borderRadius: 8, borderWidth: 1, borderColor: C.border, paddingHorizontal: 10, height: 38, minWidth: 110 },
  inputPrefix: { fontSize: 14, color: C.textSec, marginRight: 4 },
  inputSuffix: { fontSize: 12, color: C.textMuted, marginLeft: 4 },
  input: { flex: 1, fontSize: 14, color: C.text, minWidth: 50 },
  calcHint: { backgroundColor: C.raised, borderRadius: 6, padding: 8, marginTop: -4, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  calcHintText: { fontSize: 12, color: C.textSec },
  toggleSwitch: { width: 44, height: 26, borderRadius: 13, backgroundColor: C.border, justifyContent: 'center', paddingHorizontal: 3 },
  toggleSwitchOn: { backgroundColor: C.accentDim },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: C.textMuted },
  toggleThumbOn: { backgroundColor: C.accent, alignSelf: 'flex-end' },
  presetBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.raised, borderRadius: 8, borderWidth: 1, borderColor: C.border, padding: 12, marginBottom: 12 },
  presetBtnText: { fontSize: 14, color: C.text, fontWeight: '500' },
  presetList: { backgroundColor: C.raised, borderRadius: 8, borderWidth: 1, borderColor: C.border, marginBottom: 12 },
  presetOpt: { padding: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  presetOptActive: { backgroundColor: C.accentDim + '40' },
  presetOptName: { fontSize: 14, color: C.text, fontWeight: '500' },
  presetOptMeta: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  costRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  costName: { fontSize: 13, fontWeight: '600', color: C.text },
  costMeta: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  addCostBtns: { flexDirection: 'row', gap: 8, marginTop: 12 },
  addCostBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: C.accentDim, backgroundColor: C.accentDim + '20' },
  addCostBtnText: { fontSize: 13, color: C.accent, fontWeight: '600' },
  addForm: { marginTop: 12, gap: 10 },
  addInput: { backgroundColor: C.raised, borderRadius: 8, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, height: 42, fontSize: 14, color: C.text },
  addRow: { flexDirection: 'row', gap: 8 },
  addFormActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  cancelBtnText: { fontSize: 13, color: C.textSec, fontWeight: '600' },
  confirmBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8, backgroundColor: C.accentDim, borderWidth: 1, borderColor: C.accent },
  confirmBtnText: { fontSize: 13, color: C.accent, fontWeight: '600' },
  communitySubmitBox: { borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 12, marginTop: 4 },
  moderationNote: { fontSize: 11, color: C.textMuted, marginTop: 6 },
  communityPanel: { marginTop: 12, borderWidth: 1, borderColor: C.border, borderRadius: 10, overflow: 'hidden' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.raised },
  searchInput: { flex: 1, fontSize: 14, color: C.text },
  communityItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  communityItemAdded: { backgroundColor: C.successBg + '60' },
  communityItemName: { fontSize: 14, fontWeight: '600', color: C.text },
  communityItemMeta: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  communityItemDesc: { fontSize: 11, color: C.textSec, marginTop: 3, fontStyle: 'italic' },
  addTag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: C.accentDim, backgroundColor: C.accentDim + '20' },
  addTagDone: { borderColor: C.success + '60', backgroundColor: C.successBg },
  addTagText: { fontSize: 12, color: C.accent, fontWeight: '600' },
  errorText: { fontSize: 13, color: C.critical, padding: 12 },
  emptyText: { fontSize: 13, color: C.textMuted, padding: 12 },
  taxNote: { fontSize: 12, color: C.textMuted, lineHeight: 17, marginTop: 4 },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 10 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  resultLabel: { fontSize: 13, color: C.textSec },
  resultVal: { fontSize: 13, fontWeight: '500', color: C.text },
  profitBox: { borderRadius: 10, borderWidth: 1.5, padding: 16, marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  profitLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  profitValue: { fontSize: 24, fontWeight: '700' },
  perHour: { fontSize: 12, color: C.textMuted, textAlign: 'center', marginTop: 8 },
  alertBox: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: C.criticalBg, borderRadius: 8, borderWidth: 1, borderColor: C.critical, padding: 10, marginTop: 10 },
  alertText: { fontSize: 12, color: C.critical, flex: 1, lineHeight: 17 },
});
