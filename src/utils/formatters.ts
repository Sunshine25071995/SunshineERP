import { ProductionRoll, SlittingRoll, ProductionWastage, JobCardWastageSummary } from '../types';

/**
 * All weight and wastage values display with exactly 3 decimals: 0.000 format
 */
export function formatWeight(val: number | string | undefined | null): string {
  const num = typeof val === 'number' ? val : parseFloat(String(val || 0));
  if (isNaN(num)) return '0.000';
  return num.toFixed(3);
}

/**
 * Calculates wastage summary for a specific Job Card.
 */
export function calculateJobCardWastage(
  jobCardId: string,
  prodRolls: ProductionRoll[],
  slitRolls: SlittingRoll[],
  prodWastages: ProductionWastage[]
): JobCardWastageSummary {
  // Filter rolls for this job card
  const jcProdRolls = prodRolls.filter((r) => r.jobCardId === jobCardId);
  const jcSlitRolls = slitRolls.filter((r) => r.jobCardId === jobCardId);
  const jcProdWastages = prodWastages.filter((w) => w.jobCardId === jobCardId);

  // Total Production Output
  const totalProdOutputWeight = jcProdRolls.reduce((sum, r) => sum + (r.netWeight || 0), 0);

  // Production rolls marked "Taken into Slitting"
  const takenProdRolls = jcProdRolls.filter((r) => r.takenBySlitting);
  const takenProdWeight = takenProdRolls.reduce((sum, r) => sum + (r.netWeight || 0), 0);

  // Total Slitting Output
  const slittingOutputWeight = jcSlitRolls.reduce((sum, r) => sum + (r.netWeight || 0), 0);

  // Slitting Wastage = Taken Prod Weight - Slitting Output Weight
  // If no rolls taken or slitting output exceeds, clamp if necessary, but standard math is takenProdWeight - slittingOutputWeight
  const slittingWastage = Math.max(0, takenProdWeight - slittingOutputWeight);

  // Production Wastage = sum of manual entries
  const productionWastage = jcProdWastages.reduce((sum, w) => sum + (w.wastageWeight || 0), 0);

  // Final Wastage = Production Wastage + Slitting Wastage
  const finalWastage = productionWastage + slittingWastage;

  return {
    productionWastage,
    slittingWastage,
    finalWastage,
    takenProdWeight,
    slittingOutputWeight,
    totalProdOutputWeight,
  };
}
