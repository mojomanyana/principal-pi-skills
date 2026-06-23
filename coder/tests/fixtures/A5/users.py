def get_user(id):
    return db.find(id)


def show_dashboard(uid):
    a = get_user(1)
    b = get_user(2)
    return render(a, b, get_user(uid))
