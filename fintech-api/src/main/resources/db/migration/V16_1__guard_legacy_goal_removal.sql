-- Stop before V17 can discard populated legacy tables or transaction associations.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM goals)
        OR EXISTS (SELECT 1 FROM goal_allocations)
        OR EXISTS (SELECT 1 FROM transactions WHERE goal_id IS NOT NULL) THEN
        RAISE EXCEPTION 'Legacy goal records exist. Rehearse and archive them before the V17 transition.';
    END IF;
END $$;
