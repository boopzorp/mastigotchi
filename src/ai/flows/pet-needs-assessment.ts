'use server';
/**
 * @fileOverview An AI agent to assess a pet's needs based on its status indicators.
 *
 * - petNeedsAssessment - A function that assesses the pet's needs.
 * - PetNeedsAssessmentInput - The input type for the petNeedsAssessment function.
 * - PetNeedsAssessmentOutput - The return type for the petNeedsAssessment function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PetNeedsAssessmentInputSchema = z.object({
  hunger: z.number().describe('The pet\'s hunger level (0-100).'),
  happiness: z.number().describe('The pet\'s happiness level (0-100).'),
  cleanliness: z.number().describe('The pet\'s cleanliness level (0-100).'),
});
export type PetNeedsAssessmentInput = z.infer<typeof PetNeedsAssessmentInputSchema>;

const PetNeedsAssessmentOutputSchema = z.object({
  needs: z.string().describe('A personalized recommendation on what the pet needs most at the moment.'),
});
export type PetNeedsAssessmentOutput = z.infer<typeof PetNeedsAssessmentOutputSchema>;

export async function petNeedsAssessment(input: PetNeedsAssessmentInput): Promise<PetNeedsAssessmentOutput> {
  return petNeedsAssessmentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'petNeedsAssessmentPrompt',
  input: {schema: PetNeedsAssessmentInputSchema},
  output: {schema: PetNeedsAssessmentOutputSchema},
  prompt: `Based on the pet\'s current status, provide a single, personalized recommendation on what the pet needs most at the moment.

Here are the pet\'s current status levels:
- Hunger: {{hunger}}
- Happiness: {{happiness}}
- Cleanliness: {{cleanliness}}

Recommendation:`,
});

const petNeedsAssessmentFlow = ai.defineFlow(
  {
    name: 'petNeedsAssessmentFlow',
    inputSchema: PetNeedsAssessmentInputSchema,
    outputSchema: PetNeedsAssessmentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
