import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { fitnessApi } from './fitnessApi';
import { fitPath } from './paths';
import { Button, Card, ChipGroup, FIT, Field, FitnessPage, HeaderIconButton, Icon, MEAL_TYPES, Muted, SectionHeader, Stepper, errorMessage, fmt, num, onlyDecimal } from './ui';

const COMMON_FOODS = [
  { name: 'Plain rice (1 cup)', serving: '1 cup', calories: 205, proteinG: 4, carbsG: 45, fatG: 0.4, fiberG: 0.6 },
  { name: 'Roti / chapati', serving: '1 piece', calories: 120, proteinG: 3, carbsG: 18, fatG: 3.7, fiberG: 2 },
  { name: 'Dal (1 cup)', serving: '1 cup', calories: 230, proteinG: 18, carbsG: 40, fatG: 0.8, fiberG: 15 },
  { name: 'Boiled egg', serving: '1 large', calories: 78, proteinG: 6, carbsG: 0.6, fatG: 5, fiberG: 0 },
  { name: 'Chicken breast (100 g)', serving: '100 g', calories: 165, proteinG: 31, carbsG: 0, fatG: 3.6, fiberG: 0 },
  { name: 'Fish curry', serving: '1 bowl', calories: 280, proteinG: 26, carbsG: 8, fatG: 16, fiberG: 1 },
  { name: 'Chicken biryani', serving: '1 plate', calories: 600, proteinG: 28, carbsG: 75, fatG: 20, fiberG: 3 },
  { name: 'Mixed vegetable curry', serving: '1 cup', calories: 150, proteinG: 4, carbsG: 16, fatG: 8, fiberG: 5 },
  { name: 'Oatmeal with fruit', serving: '1 bowl', calories: 350, proteinG: 12, carbsG: 58, fatG: 9, fiberG: 8 },
  { name: 'Greek yogurt & berries', serving: '1 cup', calories: 220, proteinG: 20, carbsG: 25, fatG: 3, fiberG: 4 },
  { name: 'Banana', serving: '1 medium', calories: 105, proteinG: 1.3, carbsG: 27, fatG: 0.4, fiberG: 3 },
  { name: 'Apple', serving: '1 medium', calories: 95, proteinG: 0.5, carbsG: 25, fatG: 0.3, fiberG: 4 },
  { name: 'Milk tea with sugar', serving: '1 cup', calories: 90, proteinG: 2, carbsG: 14, fatG: 3, fiberG: 0 },
  { name: 'Peanuts (30 g)', serving: '30 g', calories: 170, proteinG: 7, carbsG: 5, fatG: 14, fiberG: 2.5 },
  { name: 'Whey protein shake', serving: '1 scoop', calories: 120, proteinG: 24, carbsG: 3, fatG: 1.5, fiberG: 0 },
  { name: 'Paratha', serving: '1 piece', calories: 260, proteinG: 5, carbsG: 36, fatG: 11, fiberG: 2 },
];

const FIELDS = [
  { key: 'calories', label: 'Calories', suffix: 'kcal' },
  { key: 'proteinG', label: 'Protein', suffix: 'g' },
  { key: 'carbsG', label: 'Carbs', suffix: 'g' },
  { key: 'fatG', label: 'Fat', suffix: 'g' },
  { key: 'fiberG', label: 'Fiber', suffix: 'g' },
];

const defaultMealType = () => {
  const hour = new Date().getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour >= 18 && hour < 23) return 'dinner';
  return 'snack';
};

const perServing = (meal) => {
  const servings = Number(meal?.servings) || 1;
  const scale = (value) => (value === undefined || value === null || value === '' ? '' : Math.round((Number(value) / servings) * 10) / 10);
  return { name: meal?.name || '', calories: scale(meal?.calories), proteinG: scale(meal?.proteinG), carbsG: scale(meal?.carbsG), fatG: scale(meal?.fatG), fiberG: scale(meal?.fiberG) };
};

const FitnessMeal = () => {
  const navigate = useNavigate();
  const params = useLocation().state || {};
  const editingMeal = params.meal;
  const initial = editingMeal || params.analysis || {};
  const [base, setBase] = useState(() => perServing(editingMeal ? initial : { ...initial, servings: 1 }));
  const [servings, setServings] = useState(Number(editingMeal?.servings) || 1);
  const [mealType, setMealType] = useState(editingMeal?.mealType || params.mealType || initial.mealType || defaultMealType());
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(editingMeal?.imageUrl && /^https?:/.test(editingMeal.imageUrl) ? editingMeal.imageUrl : null);
  const [source, setSource] = useState(editingMeal?.source || params.source || 'manual');
  const [recent, setRecent] = useState([]);
  const [showAllFoods, setShowAllFoods] = useState(false);
  const cameraInput = useRef(null);
  const galleryInput = useRef(null);

  useEffect(() => {
    if (editingMeal) return;
    fitnessApi.getRecentMeals().then((response) => setRecent(response.data.meals || [])).catch(() => {});
  }, [editingMeal]);

  useEffect(() => () => { if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview); }, [imagePreview]);

  const set = (key) => (value) => setBase((old) => ({ ...old, [key]: key === 'name' ? value : onlyDecimal(value) }));
  const fill = (values, nextSource = 'manual') => {
    setBase((old) => ({ ...old, ...values }));
    setServings(1);
    setSource(nextSource);
  };

  const onPickFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|heic)$/i.test(file.type)) { toast.warn('Choose a JPEG, PNG, WebP or HEIC photo.'); return; }
    if (file.size > 8 * 1024 * 1024) { toast.warn('Photos must be under 8 MB.'); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const analyze = async () => {
    if (!imageFile && !base.name.trim()) {
      toast.info('Add a photo or describe what you ate, e.g. "2 rotis with chicken curry".');
      return;
    }
    try {
      let payload = { name: base.name, mealType };
      if (imageFile) {
        payload = new FormData();
        payload.append('name', base.name || 'meal');
        payload.append('mealType', mealType);
        payload.append('image', imageFile);
      }
      const response = await fitnessApi.analyzeMeal(payload);
      const analysis = response.data.analysis || {};
      if (response.data.provider === 'placeholder' || analysis.calories === null) {
        toast.info('AI analysis is unavailable. Enter values manually or pick a common food below.');
        return;
      }
      fill({ name: analysis.name || base.name, calories: analysis.calories, proteinG: analysis.proteinG, carbsG: analysis.carbsG, fatG: analysis.fatG, fiberG: analysis.fiberG }, response.data.provider || 'gemini');
    } catch (_) {
      toast.error('Could not analyze this meal. You can add it manually.');
    }
  };

  const totals = FIELDS.reduce((acc, field) => ({ ...acc, [field.key]: Math.round((Number(base[field.key]) || 0) * servings * 10) / 10 }), {});
  const macroCalories = totals.proteinG * 4 + totals.carbsG * 4 + totals.fatG * 9;
  const mismatch = totals.calories > 0 && macroCalories > 0 && Math.abs(macroCalories - totals.calories) > Math.max(60, totals.calories * 0.25);

  const save = async () => {
    if (!base.name.trim()) { toast.warn('Add a food name before saving.'); return; }
    if (!(Number(base.calories) > 0)) { toast.warn('Add a calorie value before saving.'); return; }
    const payload = {
      name: base.name.trim(),
      mealType,
      servings,
      calories: totals.calories,
      proteinG: totals.proteinG,
      carbsG: totals.carbsG,
      fatG: totals.fatG,
      fiberG: totals.fiberG,
      source: ['manual', 'gemini', 'placeholder'].includes(source) ? source : 'manual',
      // Browser blob: previews are not shareable URLs, so only keep hosted images.
      imageUrl: imagePreview && /^https?:/.test(imagePreview) ? imagePreview : undefined,
    };
    try {
      if (editingMeal?._id) await fitnessApi.updateMeal(editingMeal._id, payload);
      else await fitnessApi.createMeal({ ...payload, date: new Date().toISOString() });
      toast.success(editingMeal ? 'Meal updated' : 'Meal logged');
      navigate(fitPath('dashboard'));
    } catch (error) {
      toast.error(errorMessage(error, 'Please check the nutrition values.'));
    }
  };

  const remove = async () => {
    if (!window.confirm(`Remove "${editingMeal?.name}"?`)) return;
    try { await fitnessApi.deleteMeal(editingMeal._id); navigate(-1); } catch (e) { toast.error(errorMessage(e, 'Could not delete this meal')); }
  };

  const foods = showAllFoods ? COMMON_FOODS : COMMON_FOODS.slice(0, 6);

  return (
    <FitnessPage
      title={editingMeal ? 'Edit meal' : 'Log food'}
      right={editingMeal ? <HeaderIconButton icon="trash-can-outline" label="Delete meal" onClick={remove} /> : undefined}
      footer={
        <>
          <div style={{ flex: 1 }}>
            <div className="fit-footer-kcal">{fmt(totals.calories)} kcal</div>
            <div className="fit-muted" style={{ fontSize: 12 }}>P {num(totals.proteinG)} · C {num(totals.carbsG)} · F {num(totals.fatG)}</div>
          </div>
          <Button label={editingMeal ? 'Update' : 'Save meal'} loadingLabel="Saving..." icon="check" variant="primary" onClick={save} auto />
        </>
      }
    >
      <ChipGroup value={mealType} onChange={setMealType} options={MEAL_TYPES} />

      {!editingMeal ? (
        <Card style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Icon name="creation" size={20} color={FIT.primary} />
            <div className="fit-card-title">Snap or describe your meal</div>
          </div>
          <Muted style={{ fontSize: 13, marginBottom: 12 }}>AI estimates calories and macros. Always review before saving.</Muted>
          <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={onPickFile} />
          <input ref={galleryInput} type="file" accept="image/jpeg,image/png,image/webp,image/heic" hidden onChange={onPickFile} />
          {imagePreview ? (
            <div className="fit-photo">
              <img src={imagePreview} alt="Selected meal" />
              <button type="button" className="fit-photo-remove" aria-label="Remove photo" onClick={() => { setImageFile(null); setImagePreview(null); }}><Icon name="close" size={18} /></button>
            </div>
          ) : (
            <div className="fit-photo-buttons">
              <button type="button" className="fit-photo-btn" onClick={() => cameraInput.current?.click()}><Icon name="camera-outline" size={26} />Camera</button>
              <button type="button" className="fit-photo-btn" onClick={() => galleryInput.current?.click()}><Icon name="image-outline" size={26} />Upload photo</button>
            </div>
          )}
          <Field label="What did you eat?" value={base.name} onChange={set('name')} placeholder="e.g. 2 rotis with chicken curry" style={{ marginTop: 12, marginBottom: 0 }} />
          <Button label="Analyze with AI" loadingLabel="Analyzing..." icon="auto-fix" onClick={analyze} />
          {source === 'gemini' ? <Muted style={{ fontSize: 12, marginTop: 8, color: 'var(--fit-warning)' }}>AI-filled values are estimates. Adjust portions below if needed.</Muted> : null}
        </Card>
      ) : null}

      {!editingMeal && recent.length ? (
        <>
          <SectionHeader title="Recent" />
          <div className="fit-hscroll">
            {recent.map((meal) => (
              <button key={meal.name} type="button" className="fit-recent" onClick={() => { fill(perServing({ ...meal, servings: 1 })); if (meal.mealType) setMealType(meal.mealType); }}>
                <div className="fit-item-name">{meal.name}</div>
                <div className="fit-item-sub">{fmt(meal.calories)} kcal{meal.count > 1 ? ` · ${meal.count}x` : ''}</div>
              </button>
            ))}
          </div>
        </>
      ) : null}

      {!editingMeal ? (
        <>
          <SectionHeader title="Common foods" action={showAllFoods ? 'Show less' : 'Show all'} onAction={() => setShowAllFoods((value) => !value)} />
          <Card style={{ padding: '4px 16px' }}>
            {foods.map((food) => (
              <button key={food.name} type="button" className="fit-food-row fit-list-sep" onClick={() => fill(food)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="fit-item-name">{food.name}</div>
                  <div className="fit-item-sub">{food.serving} · P {food.proteinG}g · C {food.carbsG}g · F {food.fatG}g</div>
                </div>
                <span className="fit-item-kcal">{food.calories}</span>
                <Icon name="plus-circle-outline" size={20} />
              </button>
            ))}
          </Card>
        </>
      ) : null}

      <SectionHeader title="Nutrition per serving" />
      <Card>
        {editingMeal ? <Field label="Food name" value={base.name} onChange={set('name')} /> : null}
        <div className="fit-field-grid">
          {FIELDS.map((field) => <Field key={field.key} label={field.label} value={base[field.key]} onChange={set(field.key)} inputMode="decimal" suffix={field.suffix} />)}
        </div>
        <span className="fit-label" style={{ marginTop: 4, marginBottom: 8 }}>Servings</span>
        <Stepper value={servings} onChange={setServings} step={0.5} min={0.5} max={20} decimals={1} suffix="x" />
        {mismatch ? (
          <div className="fit-warning">
            <Icon name="alert-circle-outline" size={18} />
            <Muted style={{ flex: 1, fontSize: 12 }}>Macros add up to about {fmt(macroCalories)} kcal (4/4/9 rule). Double-check the values.</Muted>
          </div>
        ) : null}
        <div className="fit-legend">
          {[{ label: 'Protein', value: totals.proteinG * 4, color: FIT.protein }, { label: 'Carbs', value: totals.carbsG * 4, color: FIT.carbs }, { label: 'Fat', value: totals.fatG * 9, color: FIT.fat }].map((item) => (
            <span key={item.label}><span className="fit-swatch" style={{ background: item.color }} />{item.label} {macroCalories ? Math.round((item.value / macroCalories) * 100) : 0}%</span>
          ))}
        </div>
      </Card>
    </FitnessPage>
  );
};

export default FitnessMeal;
