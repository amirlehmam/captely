# routers/salesnav.py
@router.post("/salesnav", status_code=201)
async def import_salesnav(data: List[LeadIn], user=Depends(get_user)):
    job = create_import_job(user.id, source="salesnav", total=len(data))
    # push une task par lead
    for lead in data:
        celery_app.send_task("tasks.enrich_contact", args=[lead.dict(), job.id, user.id])
    return {"job_id": job.id}
