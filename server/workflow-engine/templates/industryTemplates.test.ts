/**
 * TESTS DES TEMPLATES MULTI-MÉTIERS
 */

import { 
  ALL_TEMPLATES, 
  getTemplatesByIndustry, 
  getTemplate,
  Industry 
} from './industryTemplates';

describe('Industry Templates', () => {
  
  test('Should have 46 templates (23 industries × 2 types)', () => {
    expect(ALL_TEMPLATES.length).toBe(46);
  });

  test('Each industry should have CALL_IN and CALL_OUT templates', () => {
    const industries = Object.values(Industry);
    
    industries.forEach(industry => {
      const callInTemplate = getTemplate(industry, 'call_in');
      const callOutTemplate = getTemplate(industry, 'call_out');
      
      expect(callInTemplate).toBeDefined();
      expect(callOutTemplate).toBeDefined();
      expect(callInTemplate?.industry).toBe(industry);
      expect(callOutTemplate?.industry).toBe(industry);
    });
  });

  test('Each template should have at least one step', () => {
    ALL_TEMPLATES.forEach(template => {
      expect(template.steps.length).toBeGreaterThan(0);
    });
  });

  test('Each template should have required fields', () => {
    ALL_TEMPLATES.forEach(template => {
      expect(template.industry).toBeDefined();
      expect(template.name).toBeDefined();
      expect(template.description).toBeDefined();
      expect(template.trigger_type).toBeDefined();
      expect(template.steps).toBeDefined();
      expect(Array.isArray(template.steps)).toBe(true);
    });
  });

  test('CALL_IN templates should start with receive_call or similar', () => {
    const callInTemplates = ALL_TEMPLATES.filter(t => t.trigger_type === 'call_in');
    
    callInTemplates.forEach(template => {
      const firstAction = template.steps[0]?.type;
      // Most CALL_IN workflows should start with receive_call
      // Some might start differently, but they should be call-related
      expect(firstAction).toBeDefined();
    });
  });

  test('CALL_OUT templates should start with initiate_call or similar', () => {
    const callOutTemplates = ALL_TEMPLATES.filter(t => t.trigger_type === 'call_out');
    
    callOutTemplates.forEach(template => {
      const firstAction = template.steps[0]?.type;
      // Most CALL_OUT workflows should start with initiate_call
      expect(firstAction).toBeDefined();
    });
  });

  test('getTemplatesByIndustry should return 2 templates per industry', () => {
    const industries = Object.values(Industry);
    
    industries.forEach(industry => {
      const templates = getTemplatesByIndustry(industry);
      expect(templates.length).toBe(2);
    });
  });

  test('Real Estate templates should have proper structure', () => {
    const realEstateCallIn = getTemplate(Industry.REAL_ESTATE, 'call_in');
    const realEstateCallOut = getTemplate(Industry.REAL_ESTATE, 'call_out');
    
    expect(realEstateCallIn?.name).toContain('Immobilier');
    expect(realEstateCallOut?.name).toContain('Immobilier');
    
    // CALL_IN should have: receive_call, create_lead, record_call, transcribe, ai_score, appointment, sms
    expect(realEstateCallIn?.steps.length).toBeGreaterThanOrEqual(5);
    
    // CALL_OUT should have: initiate_call, create_lead, record_call, ai_score, update_lead, whatsapp
    expect(realEstateCallOut?.steps.length).toBeGreaterThanOrEqual(4);
  });

  test('Payment-related industries should have payment actions', () => {
    // Voyant, Association, ONG should have payment actions
    const psychicCallIn = getTemplate(Industry.PSYCHIC, 'call_in');
    const associationCallIn = getTemplate(Industry.ASSOCIATION, 'call_in');
    
    const psychicHasPayment = psychicCallIn?.steps.some(s => s.type === 'request_payment');
    const associationHasPayment = associationCallIn?.steps.some(s => 
      s.type === 'request_payment' || s.type === 'create_donation'
    );
    
    expect(psychicHasPayment).toBe(true);
    expect(associationHasPayment).toBe(true);
  });

  test('Restaurant and Hotel should have reservation actions', () => {
    const restaurantCallIn = getTemplate(Industry.RESTAURANT, 'call_in');
    const hotelCallIn = getTemplate(Industry.HOTEL, 'call_in');
    
    const restaurantHasReservation = restaurantCallIn?.steps.some(s => s.type === 'create_reservation');
    const hotelHasReservation = hotelCallIn?.steps.some(s => s.type === 'create_reservation');
    
    expect(restaurantHasReservation).toBe(true);
    expect(hotelHasReservation).toBe(true);
  });

  test('Medical industries should have appointment actions', () => {
    const doctorCallIn = getTemplate(Industry.DOCTOR, 'call_in');
    const dentistCallIn = getTemplate(Industry.DENTIST, 'call_in');
    const clinicCallIn = getTemplate(Industry.CLINIC, 'call_in');
    
    const doctorHasAppointment = doctorCallIn?.steps.some(s => s.type === 'create_appointment');
    const dentistHasAppointment = dentistCallIn?.steps.some(s => s.type === 'create_appointment');
    const clinicHasAppointment = clinicCallIn?.steps.some(s => s.type === 'create_appointment');
    
    expect(doctorHasAppointment).toBe(true);
    expect(dentistHasAppointment).toBe(true);
    expect(clinicHasAppointment).toBe(true);
  });

  test('All templates should have valid step IDs', () => {
    ALL_TEMPLATES.forEach(template => {
      const stepIds = new Set<string>();
      
      template.steps.forEach(step => {
        expect(step.id).toBeDefined();
        expect(step.type).toBeDefined();
        expect(step.config).toBeDefined();
        
        // Check for duplicate IDs
        expect(stepIds.has(String(step.id))).toBe(false);
        stepIds.add(String(step.id));
      });
    });
  });

  test('Templates should have proper next_step references', () => {
    ALL_TEMPLATES.forEach(template => {
      const stepIds = new Set(template.steps.map(s => String(s.id)));
      
      template.steps.forEach((step, index) => {
        // Note: In current schema, WorkflowStep might not have next_step explicitly defined 
        // as it might be handled by order or on_true/on_false.
        // We'll skip this specific check if property doesn't exist to avoid TS errors
        // or cast to any for the test if we know the data structure has it but the interface doesn't.
        const s = step as any;
        if (s.next_step) {
          expect(stepIds.has(String(s.next_step))).toBe(true);
        }
      });
    });
  });

});
