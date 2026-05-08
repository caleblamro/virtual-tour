import lpips as _l

_cache = {}

def lpips(x, y, net="alex", normalize=False):
    key = (net, str(x.device))
    if key not in _cache:
        _cache[key] = _l.LPIPS(net=net).to(x.device)
    fn = _cache[key]
    if normalize:
        x, y = 2 * x - 1, 2 * y - 1
    return fn(x, y)
